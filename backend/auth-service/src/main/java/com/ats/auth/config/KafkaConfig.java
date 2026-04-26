package com.ats.auth.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {

    public static final String ATS_EVENTS_TOPIC = "ats.events";

    @Bean
    public NewTopic atsEventsTopic() {
        return new NewTopic(ATS_EVENTS_TOPIC, 1, (short) 1);
    }
}
