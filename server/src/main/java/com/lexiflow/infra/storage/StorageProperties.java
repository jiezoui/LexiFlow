package com.lexiflow.infra.storage;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "lexiflow.storage")
public class StorageProperties {

    private String type = "local";
    private Local local = new Local();
    private Minio minio = new Minio();

    @Data
    public static class Local {
        private String root = "./storage";
    }

    @Data
    public static class Minio {
        private String endpoint = "http://localhost:9000";
        private String accessKey = "minioadmin";
        private String secretKey = "minioadmin";
        private String bucket = "lexiflow-media";
    }
}
