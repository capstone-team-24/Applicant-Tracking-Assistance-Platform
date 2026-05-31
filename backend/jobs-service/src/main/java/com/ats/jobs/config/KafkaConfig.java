package com.ats.jobs.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {

    public static final String APPLICATION_SUBMITTED_TOPIC = "application.submitted";
    public static final String JOB_RANK_REQUEST_TOPIC = "job.rank.request";
    public static final String JOB_RANK_RESULT_TOPIC = "job.rank.result";
    public static final String ASSESSMENT_EVENTS_TOPIC = "assessment.events";

    @Bean
    public NewTopic applicationSubmittedTopic() {
        return new NewTopic(APPLICATION_SUBMITTED_TOPIC, 1, (short) 1);
    }

    @Bean
    public NewTopic jobRankRequestTopic() {
        return new NewTopic(JOB_RANK_REQUEST_TOPIC, 1, (short) 1);
    }

    @Bean
    public NewTopic jobRankResultTopic() {
        return new NewTopic(JOB_RANK_RESULT_TOPIC, 1, (short) 1);
    }

    @Bean
    public NewTopic assessmentEventsTopic() {
        return new NewTopic(ASSESSMENT_EVENTS_TOPIC, 1, (short) 1);
    }
}
