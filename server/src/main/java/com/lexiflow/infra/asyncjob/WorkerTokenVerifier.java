package com.lexiflow.infra.asyncjob;

import com.lexiflow.common.exception.BusinessException;
import com.lexiflow.common.result.ResultCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
@RequiredArgsConstructor
public class WorkerTokenVerifier {

    private final AsyncJobProperties properties;

    public void verify(String suppliedToken) {
        byte[] expected = properties.getWorkerToken().getBytes(StandardCharsets.UTF_8);
        byte[] supplied = suppliedToken == null
                ? new byte[0]
                : suppliedToken.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, supplied)) {
            throw new BusinessException(ResultCode.WORKER_UNAUTHORIZED);
        }
    }
}
