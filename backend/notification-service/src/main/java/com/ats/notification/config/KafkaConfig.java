package com.ats.notification.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {

    public static final String TOPIC_APPLICATION_SUBMITTED = "application.submitted";
    public static final String TOPIC_PARSE_COMPLETED = "resume.parse.completed";
    public static final String TOPIC_RANK_RESULT = "job.rank.result";

    @Bean
    public NewTopic applicationSubmittedTopic() {
        return new NewTopic(TOPIC_APPLICATION_SUBMITTED, 1, (short) 1);
    }
    
    @Bean
    public NewTopic parseCompletedTopic() {
        return new NewTopic(TOPIC_PARSE_COMPLETED, 1, (short) 1);
    }

    @Bean
    public NewTopic rankResultTopic() {
        return new NewTopic(TOPIC_RANK_RESULT, 1, (short) 1);
    }
}
