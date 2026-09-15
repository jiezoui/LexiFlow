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
            return claims.getExpiration().after(new Date());
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
