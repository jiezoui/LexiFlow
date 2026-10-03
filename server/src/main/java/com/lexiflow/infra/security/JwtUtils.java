package com.lexiflow.infra.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * JWT 工具类，基于 JJWT 0.12.x
 */
@Component
public class JwtUtils {

    private static final long MEDIA_STREAM_TOKEN_LIFETIME_MS = 12L * 60 * 60 * 1000;

    private final SecretKey secretKey;
    private final long expirationMillis;

    public JwtUtils(
            @Value("${lexiflow.jwt.secret:TGV4aUZsb3dNdWx0aU1vZGFsQ29nbml0aXZlU3BhY2VkUmVwZXRpdGlvbkp3dFNlY3JldEtleTIwMjY=}") String secret,
            @Value("${lexiflow.jwt.expiration:604800000}") long expirationMillis
    ) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, keyBytes.length);
            this.secretKey = Keys.hmacShaKeyFor(padded);
        } else {
            this.secretKey = Keys.hmacShaKeyFor(keyBytes);
        }
        this.expirationMillis = expirationMillis;
    }

    /**
     * 为指定用户生成 JWT 访问令牌
     */
    public String generateToken(Long userId, String username) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("username", username);
        claims.put("scope", "user");

        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMillis);

        return Jwts.builder()
                .claims(claims)
                .subject(String.valueOf(userId))
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(secretKey)
                .compact();
    }

    /** A short-lived token scoped to one media stream; safe for native audio/video elements. */
    public String generateMediaStreamToken(Long userId, String mediaPublicId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("scope", "media-stream")
                .claim("mediaId", mediaPublicId)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + MEDIA_STREAM_TOKEN_LIFETIME_MS))
                .signWith(secretKey)
                .compact();
    }

    public Long mediaStreamUserId(String token, String mediaPublicId) {
        try {
            Claims claims = parseClaims(token);
            if (!claims.getExpiration().after(new Date())
                    || !"media-stream".equals(claims.get("scope", String.class))
                    || !mediaPublicId.equals(claims.get("mediaId", String.class))) {
                return null;
            }
            return Long.parseLong(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * 解析 JWT Claims
     */
    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * 校验 Token 是否合法且未过期
     */
    public boolean validateToken(String token) {
        try {
            Claims claims = parseClaims(token);
            String scope = claims.get("scope", String.class);
            return claims.getExpiration().after(new Date())
                    && (scope == null || "user".equals(scope));
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * 从 Token 中提取 User ID
     */
    public Long getUserIdFromToken(String token) {
        Claims claims = parseClaims(token);
        Object userIdObj = claims.get("userId");
        if (userIdObj instanceof Number) {
            return ((Number) userIdObj).longValue();
        }
        return Long.parseLong(claims.getSubject());
    }

    /**
     * 从 Token 中提取用户名
     */
    public String getUsernameFromToken(String token) {
        Claims claims = parseClaims(token);
        return claims.get("username", String.class);
    }
}
