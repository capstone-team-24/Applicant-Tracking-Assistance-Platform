package com.ats.user.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI userServiceOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("User Service API")
                        .description("ATS User Service - manages user profiles, organizations, and documents")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("ATS Team")
                                .email("team@ats.com")));
    }
}
