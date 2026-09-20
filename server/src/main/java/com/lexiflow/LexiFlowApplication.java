package com.lexiflow;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan(basePackages = {
        "com.lexiflow.modules.user.mapper",
        "com.lexiflow.modules.dictionary.mapper",
        "com.lexiflow.modules.wordbook.mapper",
        "com.lexiflow.modules.vocabulary.mapper",
        "com.lexiflow.modules.review.mapper",
        "com.lexiflow.modules.stats.mapper",
        "com.lexiflow.modules.reading.mapper",
        "com.lexiflow.modules.media.mapper",
        "com.lexiflow.modules.contextual.mapper",
        "com.lexiflow.modules.shadowing.mapper",
        "com.lexiflow.infra.asyncjob.mapper"
})
public class LexiFlowApplication {

    public static void main(String[] args) {
        SpringApplication.run(LexiFlowApplication.class, args);
    }
}
