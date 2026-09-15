package com.lexiflow.infra.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI lexiflowOpenAPI() {
        final String securitySchemeName = "BearerAuth";
        return new OpenAPI()
                .info(new Info()
                        .title("语脉 · LexiFlow 多模态认知研习引擎 REST API")
                        .description("基于 FSRS 记忆算法、视频语境采词、大纲词书管理与打卡统计的全栈企业级 API 文档")
                        .version("v1.0.0")
                        .contact(new Contact()
                                .name("LexiFlow 架构组")
                                .email("contact@lexiflow.local"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName, new SecurityScheme()
                                .name(securitySchemeName)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("请在此输入 JWT 令牌 (例如：从登录接口获取到的 token)")));
    }
}
