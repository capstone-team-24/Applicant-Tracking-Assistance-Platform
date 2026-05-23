package com.ats.jobs.service;

import com.ats.jobs.dto.DeclineOfferRequest;
import com.ats.jobs.dto.NotificationSendRequest;
import com.ats.jobs.dto.OfferResponse;
import com.ats.jobs.dto.SendOfferRequest;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.Job;
import com.ats.jobs.entity.Offer;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.exception.BadRequestException;
import com.ats.jobs.exception.ResourceNotFoundException;
import com.ats.jobs.feign.NotificationServiceClient;
import com.ats.jobs.feign.OrgServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.repository.OfferRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OfferService {

    private final OfferRepository offerRepository;
    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final NotificationServiceClient notificationServiceClient;
    private final OrgServiceClient orgServiceClient;

    @Transactional
    public OfferResponse sendOffer(UUID applicationId, UUID recruiterId, SendOfferRequest request) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + applicationId));

        Job job = jobRepository.findById(application.getJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + application.getJobId()));

        String orgName = "The Company";
        try {
            orgName = orgServiceClient.getOrganizationName(job.getOrgId());
        } catch (Exception e) {
            log.warn("Failed to fetch org name for orgId {}", job.getOrgId());
        }

        String token = UUID.randomUUID().toString().replace("-", "");

        Offer offer = Offer.builder()
                .applicationId(applicationId)
                .token(token)
                .sentBy(recruiterId)
                .offerMessage(request.getOfferMessage())
                .salary(request.getSalary())
                .startDate(request.getStartDate())
                .build();

        offerRepository.save(offer);

        application.setStatus(ApplicationStatus.OFFER_SENT);
        applicationRepository.save(application);

        String offerLink = "http://localhost:3000/offers/" + token;
        
        String emailBody = String.format(
                "<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;\">" +
                "  <h2>Job Offer: %s at %s</h2>" +
                "  <p>Dear %s,</p>" +
                "  <p>We are thrilled to extend you an offer for the position of <strong>%s</strong>!</p>" +
                "  <p>%s</p>" +
                "  <p>Please review your offer details and let us know your decision by clicking the button below:</p>" +
                "  <a href=\"%s\" style=\"display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;\">Review Offer</a>" +
                "</div>",
                job.getTitle(), orgName, application.getCandidateName(), job.getTitle(), request.getOfferMessage(), offerLink
        );

        NotificationSendRequest notificationReq = NotificationSendRequest.builder()
                .recipientEmail(application.getCandidateEmail())
                .subject("Job Offer: " + job.getTitle() + " at " + orgName)
                .body(emailBody)
                .type("OFFER_INVITE")
                .build();

        try {
            notificationServiceClient.sendNotification(notificationReq);
            log.info("Sent offer email to {}", application.getCandidateEmail());
        } catch (Exception e) {
            log.error("Failed to send offer email to {}", application.getCandidateEmail(), e);
        }

        return mapToResponse(offer, application, job, orgName);
    }

    @Transactional(readOnly = true)
    public OfferResponse getOfferByToken(String token) {
        Offer offer = offerRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Offer not found or invalid token"));

        Application application = applicationRepository.findById(offer.getApplicationId())
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));

        Job job = jobRepository.findById(application.getJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));

        String orgName = "The Company";
        try {
            orgName = orgServiceClient.getOrganizationName(job.getOrgId());
        } catch (Exception e) {
            log.warn("Failed to fetch org name for orgId {}", job.getOrgId());
        }

        return mapToResponse(offer, application, job, orgName);
    }

    @Transactional
    public void acceptOffer(String token) {
        Offer offer = offerRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Offer not found"));

        if (offer.getAcceptedAt() != null || offer.getDeclinedAt() != null) {
            throw new BadRequestException("Offer has already been responded to.");
        }

        offer.setAcceptedAt(LocalDateTime.now());
        offerRepository.save(offer);

        Application application = applicationRepository.findById(offer.getApplicationId())
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));

        application.setStatus(ApplicationStatus.OFFER_ACCEPTED);
        applicationRepository.save(application);
        
        Job job = jobRepository.findById(application.getJobId()).orElse(null);
        String jobTitle = job != null ? job.getTitle() : "Unknown Job";

        // Notify Recruiter
        String applicationLink = "http://localhost:3000/recruiter/jobs/" + application.getJobId();
        String emailBody = String.format(
                "<p>Great news! %s has <strong>accepted</strong> the offer for %s.</p>" +
                "<a href=\"%s\">View Application</a>",
                application.getCandidateName(), jobTitle, applicationLink
        );

        NotificationSendRequest notificationReq = NotificationSendRequest.builder()
                .recipientEmail("admin@system.com") // Placeholder for recruiter email
                .subject("Offer Accepted: " + application.getCandidateName())
                .body(emailBody)
                .type("OFFER_ACCEPTED")
                .build();

        try {
            notificationServiceClient.sendNotification(notificationReq);
        } catch (Exception e) {
            log.error("Failed to notify recruiter about offer acceptance", e);
        }
    }

    @Transactional
    public void declineOffer(String token, DeclineOfferRequest request) {
        Offer offer = offerRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Offer not found"));

        if (offer.getAcceptedAt() != null || offer.getDeclinedAt() != null) {
            throw new BadRequestException("Offer has already been responded to.");
        }

        offer.setDeclinedAt(LocalDateTime.now());
        offer.setDeclineReason(request != null ? request.getReason() : null);
        offerRepository.save(offer);

        Application application = applicationRepository.findById(offer.getApplicationId())
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));

        application.setStatus(ApplicationStatus.OFFER_DECLINED);
        applicationRepository.save(application);

        Job job = jobRepository.findById(application.getJobId()).orElse(null);
        String jobTitle = job != null ? job.getTitle() : "Unknown Job";

        // Notify Recruiter
        String applicationLink = "http://localhost:3000/recruiter/jobs/" + application.getJobId();
        String emailBody = String.format(
                "<p>Unfortunately, %s has <strong>declined</strong> the offer for %s.</p>" +
                "<p>Reason: %s</p>" +
                "<a href=\"%s\">View Application</a>",
                application.getCandidateName(), jobTitle, request != null && request.getReason() != null ? request.getReason() : "None provided", applicationLink
        );

        NotificationSendRequest notificationReq = NotificationSendRequest.builder()
                .recipientEmail("admin@system.com") // Placeholder for recruiter email
                .subject("Offer Declined: " + application.getCandidateName())
                .body(emailBody)
                .type("OFFER_DECLINED")
                .build();

        try {
            notificationServiceClient.sendNotification(notificationReq);
        } catch (Exception e) {
            log.error("Failed to notify recruiter about offer decline", e);
        }
    }

    private OfferResponse mapToResponse(Offer offer, Application application, Job job, String orgName) {
        String status = "PENDING";
        if (offer.getAcceptedAt() != null) status = "ACCEPTED";
        else if (offer.getDeclinedAt() != null) status = "DECLINED";

        return OfferResponse.builder()
                .id(offer.getId())
                .applicationId(offer.getApplicationId())
                .jobTitle(job.getTitle())
                .companyName(orgName)
                .candidateName(application.getCandidateName())
                .offerMessage(offer.getOfferMessage())
                .salary(offer.getSalary())
                .startDate(offer.getStartDate())
                .status(status)
                .sentAt(offer.getSentAt())
                .acceptedAt(offer.getAcceptedAt())
                .declinedAt(offer.getDeclinedAt())
                .build();
    }
}
