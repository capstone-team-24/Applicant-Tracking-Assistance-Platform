package com.ats.user;

import com.ats.user.dto.ContactMessageRequest;
import com.ats.user.dto.ContactMessageResponse;
import com.ats.user.dto.CreateOrganizationRequest;
import com.ats.user.dto.OrganizationResponse;
import com.ats.user.dto.SendNotificationRequest;
import com.ats.user.entity.ContactMessage;
import com.ats.user.feign.NotificationServiceClient;
import com.ats.user.repository.ContactMessageRepository;
import com.ats.user.service.ContactMessageService;
import com.ats.user.service.OrganizationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContactMessageServiceTest {

    @Mock
    private ContactMessageRepository contactMessageRepository;

    @Mock
    private OrganizationService organizationService;

    @Mock
    private NotificationServiceClient notificationServiceClient;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ContactMessageService contactMessageService;

    @Test
    void create_shouldPersistAndReturnResponse() {
        ContactMessageRequest request = ContactMessageRequest.builder()
                .name("Acme Ltd")
                .email("hr@acme.com")
                .message("We want to join the platform")
                .build();

        ContactMessage saved = ContactMessage.builder()
                .id(UUID.randomUUID())
                .name(request.getName())
                .email(request.getEmail())
                .message(request.getMessage())
                .createdAt(LocalDateTime.now())
                .build();

        when(contactMessageRepository.save(any(ContactMessage.class))).thenReturn(saved);

        ContactMessageResponse response = contactMessageService.create(request);

        assertThat(response.getName()).isEqualTo("Acme Ltd");
        assertThat(response.getEmail()).isEqualTo("hr@acme.com");
        assertThat(response.getMessage()).isEqualTo("We want to join the platform");
        verify(contactMessageRepository).save(any(ContactMessage.class));
    }

    @Test
    void approve_shouldCreateOrganizationAndSendEmail() {
        UUID messageId = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();

        ContactMessage message = ContactMessage.builder()
                .id(messageId)
                .name("Acme Ltd")
                .email("hr@acme.com")
                .message("Please create our organization")
                .createdAt(LocalDateTime.now())
                .build();

        OrganizationResponse organization = OrganizationResponse.builder()
                .id(organizationId)
                .name("Acme Ltd")
                .createdAt(LocalDateTime.now())
                .isSuspended(false)
                .build();

        when(contactMessageRepository.findById(messageId)).thenReturn(Optional.of(message));
        when(organizationService.create(any(CreateOrganizationRequest.class))).thenReturn(organization);
        when(contactMessageRepository.save(any(ContactMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doNothing().when(notificationServiceClient).sendNotification(any(SendNotificationRequest.class));

        OrganizationResponse response = contactMessageService.approve(messageId);

        assertThat(response.getId()).isEqualTo(organizationId);

        ArgumentCaptor<CreateOrganizationRequest> orgCaptor = ArgumentCaptor.forClass(CreateOrganizationRequest.class);
        verify(organizationService).create(orgCaptor.capture());
        assertThat(orgCaptor.getValue().getName()).isEqualTo("Acme Ltd");

        ArgumentCaptor<ContactMessage> messageCaptor = ArgumentCaptor.forClass(ContactMessage.class);
        verify(contactMessageRepository).save(messageCaptor.capture());
        assertThat(messageCaptor.getValue().getApprovedAt()).isNotNull();
        assertThat(messageCaptor.getValue().getApprovedOrganizationId()).isEqualTo(organizationId);

        ArgumentCaptor<SendNotificationRequest> notificationCaptor = ArgumentCaptor.forClass(SendNotificationRequest.class);
        verify(notificationServiceClient).sendNotification(notificationCaptor.capture());
        assertThat(notificationCaptor.getValue().getRecipientEmail()).isEqualTo("hr@acme.com");
        assertThat(notificationCaptor.getValue().getSubject()).contains("approved");
        assertThat(notificationCaptor.getValue().getBody()).contains("data-email-template=\"ats-blue\"");
        assertThat(notificationCaptor.getValue().getBody()).contains("Registration Approved");
    }

        @Test
        void approve_shouldRejectAlreadyApprovedMessage() {
                UUID messageId = UUID.randomUUID();

                ContactMessage message = ContactMessage.builder()
                                .id(messageId)
                                .name("Acme Ltd")
                                .email("hr@acme.com")
                                .message("Please create our organization")
                                .approvedAt(LocalDateTime.now())
                                .createdAt(LocalDateTime.now())
                                .build();

                when(contactMessageRepository.findById(messageId)).thenReturn(Optional.of(message));

                assertThatThrownBy(() -> contactMessageService.approve(messageId))
                                .isInstanceOf(IllegalStateException.class)
                                .hasMessageContaining("already been approved");
        }

    @Test
    void approve_shouldFailWhenMessageMissing() {
        UUID missingId = UUID.randomUUID();
        when(contactMessageRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> contactMessageService.approve(missingId))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("ContactMessage");
    }
}
