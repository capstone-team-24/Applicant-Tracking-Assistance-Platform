package com.ats.jobs.service;

import com.google.api.client.auth.oauth2.BearerToken;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.ConferenceData;
import com.google.api.services.calendar.model.ConferenceSolutionKey;
import com.google.api.services.calendar.model.CreateConferenceRequest;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Service
@Slf4j
public class GoogleCalendarService {

    @Value("${google.client.id:}")
    private String clientId;

    @Value("${google.client.secret:}")
    private String clientSecret;

    private Calendar getCalendarService(String refreshToken) throws Exception {
        if (clientId == null || clientId.isEmpty() || clientSecret == null || clientSecret.isEmpty()) {
            throw new IllegalStateException("Google Client ID and Secret are not configured.");
        }

        Credential credential = new Credential.Builder(BearerToken.authorizationHeaderAccessMethod())
                .setTransport(GoogleNetHttpTransport.newTrustedTransport())
                .setJsonFactory(GsonFactory.getDefaultInstance())
                .setTokenServerEncodedUrl("https://oauth2.googleapis.com/token")
                .setClientAuthentication(new com.google.api.client.auth.oauth2.ClientParametersAuthentication(clientId, clientSecret))
                .build();
        
        credential.setRefreshToken(refreshToken);

        return new Calendar.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                credential)
                .setApplicationName("ATS Interview Scheduler")
                .build();
    }

    public String createInterviewEvent(String refreshToken, String jobTitle, String candidateEmail, String recruiterEmail, LocalDateTime startTime, LocalDateTime endTime) {
        if (refreshToken == null || refreshToken.isEmpty()) {
            log.warn("Refresh token is missing, returning placeholder link.");
            return "https://meet.google.com/placeholder-link-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        }

        try {
            Calendar calendarService = getCalendarService(refreshToken);

            Event event = new Event()
                    .setSummary("Interview: " + jobTitle)
                    .setDescription("Interview scheduled via ATS.");

            ZonedDateTime zdtStart = startTime.atZone(ZoneId.of("UTC"));
            com.google.api.client.util.DateTime startDateTime = new com.google.api.client.util.DateTime(zdtStart.toInstant().toEpochMilli());
            EventDateTime start = new EventDateTime().setDateTime(startDateTime).setTimeZone("UTC");
            event.setStart(start);

            ZonedDateTime zdtEnd = endTime.atZone(ZoneId.of("UTC"));
            com.google.api.client.util.DateTime endDateTime = new com.google.api.client.util.DateTime(zdtEnd.toInstant().toEpochMilli());
            EventDateTime end = new EventDateTime().setDateTime(endDateTime).setTimeZone("UTC");
            event.setEnd(end);

            ConferenceSolutionKey conferenceSlnKey = new ConferenceSolutionKey()
                    .setType("hangoutsMeet");
            CreateConferenceRequest createConferenceReq = new CreateConferenceRequest()
                    .setRequestId(java.util.UUID.randomUUID().toString())
                    .setConferenceSolutionKey(conferenceSlnKey);
            ConferenceData conferenceData = new ConferenceData()
                    .setCreateRequest(createConferenceReq);
            event.setConferenceData(conferenceData);

            Event createdEvent = calendarService.events().insert("primary", event)
                    .setConferenceDataVersion(1)
                    .execute();

            if (createdEvent.getConferenceData() != null &&
                createdEvent.getConferenceData().getEntryPoints() != null &&
                !createdEvent.getConferenceData().getEntryPoints().isEmpty()) {
                return createdEvent.getConferenceData().getEntryPoints().get(0).getUri();
            } else {
                return createdEvent.getHtmlLink();
            }

        } catch (Exception e) {
            log.error("Error creating Google Calendar event", e);
            return "https://meet.google.com/placeholder-link-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        }
    }
}
