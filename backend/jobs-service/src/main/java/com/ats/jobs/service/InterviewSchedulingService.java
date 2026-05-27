package com.ats.jobs.service;

import com.ats.jobs.dto.BookInterviewRequest;
import com.ats.jobs.dto.CreateInterviewSlotsRequest;
import com.ats.jobs.dto.NotificationSendRequest;
import com.ats.jobs.dto.SubmitInterviewFeedbackRequest;
import com.ats.jobs.dto.CandidateBookingResponse;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.InterviewBooking;
import com.ats.jobs.entity.InterviewSlot;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.exception.BadRequestException;
import com.ats.jobs.exception.ForbiddenException;
import com.ats.jobs.exception.ResourceNotFoundException;
import com.ats.jobs.feign.NotificationServiceClient;
import com.ats.jobs.entity.UserIntegration;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.InterviewBookingRepository;
import com.ats.jobs.repository.InterviewInviteRepository;
import com.ats.jobs.repository.InterviewSlotRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.repository.UserIntegrationRepository;
import com.ats.jobs.util.EmailTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewSchedulingService {

    private final InterviewSlotRepository interviewSlotRepository;
    private final InterviewBookingRepository interviewBookingRepository;
    private final InterviewInviteRepository interviewInviteRepository;
    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final NotificationServiceClient notificationServiceClient;
    private final GoogleCalendarService googleCalendarService;
    private final UserIntegrationRepository userIntegrationRepository;

    @Transactional
    public List<InterviewSlot> createSlots(UUID jobId, CreateInterviewSlotsRequest request, UUID recruiterAuthUserId, UUID orgId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }

        UserIntegration integration = userIntegrationRepository.findByAuthUserId(recruiterAuthUserId).orElse(null);
        if (integration == null || integration.getGoogleRefreshToken() == null || integration.getGoogleRefreshToken().isEmpty()) {
            throw new BadRequestException("Please connect your Google Calendar before creating interview slots.");
        }

        List<InterviewSlot> newSlots = request.getSlots().stream()
                .map(slotTime -> InterviewSlot.builder()
                        .jobId(jobId)
                        .recruiterAuthUserId(recruiterAuthUserId)
                        .startTime(slotTime.getStartTime())
                        .endTime(slotTime.getEndTime())
                        .status(InterviewSlot.SlotStatus.AVAILABLE)
                        .build())
                .toList();

        return interviewSlotRepository.saveAll(newSlots);
    }

    @Transactional(readOnly = true)
    public List<InterviewSlot> getAvailableSlots(UUID jobId, UUID candidateAuthUserId) {
        // Enforce that candidate has an invite
        if (!interviewInviteRepository.existsByJobIdAndCandidateAuthUserId(jobId, candidateAuthUserId)) {
            throw new ForbiddenException("You do not have an active interview invite for this job.");
        }

        return interviewSlotRepository.findByJobIdAndStatusAndStartTimeAfterOrderByStartTimeAsc(
                jobId, InterviewSlot.SlotStatus.AVAILABLE, LocalDateTime.now());
    }
    
    @Transactional(readOnly = true)
    public List<InterviewSlot> getJobSlots(UUID jobId, UUID recruiterAuthUserId, UUID orgId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }
        
        return interviewSlotRepository.findByJobIdAndStartTimeAfterOrderByStartTimeAsc(jobId, LocalDateTime.now().minusDays(1));
    }
    
    @Transactional(readOnly = true)
    public List<InterviewBooking> getJobBookings(UUID jobId, UUID recruiterAuthUserId, UUID orgId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }
        
        // Find all bookings for all slots of this job
        // This could be optimized with a custom query in InterviewBookingRepository, 
        // but for now we fetch the slots and then bookings.
        List<InterviewSlot> slots = interviewSlotRepository.findByJobIdAndStartTimeAfterOrderByStartTimeAsc(jobId, LocalDateTime.now().minusDays(1));
        List<UUID> slotIds = slots.stream().map(InterviewSlot::getId).toList();
        
        return interviewBookingRepository.findAll().stream()
                .filter(b -> slotIds.contains(b.getSlotId()))
                .toList();
    }

    @Transactional
    public InterviewBooking bookInterview(UUID jobId, BookInterviewRequest request, UUID candidateAuthUserId) {
        // 1. Verify candidate has invite
        if (!interviewInviteRepository.existsByJobIdAndCandidateAuthUserId(jobId, candidateAuthUserId)) {
            throw new ForbiddenException("You do not have an active interview invite for this job.");
        }

        // 2. Fetch slot
        InterviewSlot slot = interviewSlotRepository.findById(request.getSlotId())
                .orElseThrow(() -> new ResourceNotFoundException("Slot not found: " + request.getSlotId()));

        if (!slot.getJobId().equals(jobId)) {
            throw new BadRequestException("Slot does not belong to this job.");
        }

        if (slot.getStatus() != InterviewSlot.SlotStatus.AVAILABLE) {
            throw new BadRequestException("Slot is no longer available.");
        }

        if (slot.getStartTime().isBefore(LocalDateTime.now())) {
             throw new BadRequestException("Cannot book a past slot.");
        }

        // 3. Find Application
        List<Application> apps = applicationRepository.findByJobIdAndCandidateAuthUserId(jobId, candidateAuthUserId);
        if (apps.isEmpty()) {
            throw new ResourceNotFoundException("Application not found.");
        }
        Application app = apps.get(0);

        // 4. Update Slot
        slot.setStatus(InterviewSlot.SlotStatus.BOOKED);
        interviewSlotRepository.save(slot);

        // 5. Delete conflicting available slots from same recruiter
        // (Optional logic based on requirements, but let's assume recruiter can't double book)
        List<InterviewSlot> conflictingSlots = interviewSlotRepository
                .findByRecruiterAuthUserIdAndStartTimeAfterOrderByStartTimeAsc(slot.getRecruiterAuthUserId(), LocalDateTime.now());
        
        List<InterviewSlot> slotsToDelete = conflictingSlots.stream()
                .filter(s -> !s.getId().equals(slot.getId()) 
                         && s.getStatus() == InterviewSlot.SlotStatus.AVAILABLE 
                         && s.getStartTime().equals(slot.getStartTime()))
                .toList();
        
        if (!slotsToDelete.isEmpty()) {
            interviewSlotRepository.deleteAll(slotsToDelete);
        }

        // 6. Create Booking
        Job job = jobRepository.findById(jobId).orElse(null);
        String jobTitle = job != null ? job.getTitle() : "Position";
        
        String refreshToken = null;
        UserIntegration integration = userIntegrationRepository.findByAuthUserId(slot.getRecruiterAuthUserId()).orElse(null);
        if (integration != null) {
            refreshToken = integration.getGoogleRefreshToken();
        }

        String meetingLink = googleCalendarService.createInterviewEvent(
                refreshToken,
                jobTitle,
                app.getCandidateEmail(),
                null, // recruiter email can be added if fetched
                slot.getStartTime(),
                slot.getEndTime()
        );

        // Also add to candidate calendar if they connected their integration
        UserIntegration candidateIntegration = userIntegrationRepository.findByAuthUserId(candidateAuthUserId).orElse(null);
        if (candidateIntegration != null && candidateIntegration.getGoogleRefreshToken() != null && !candidateIntegration.getGoogleRefreshToken().isEmpty()) {
            try {
                googleCalendarService.addEventToCandidateCalendar(
                        candidateIntegration.getGoogleRefreshToken(),
                        jobTitle,
                        meetingLink,
                        slot.getStartTime(),
                        slot.getEndTime()
                );
            } catch (Exception e) {
                log.warn("Failed to add event to candidate calendar, but proceeding. Error: {}", e.getMessage());
            }
        }
        
        InterviewBooking booking = InterviewBooking.builder()
                .slotId(slot.getId())
                .applicationId(app.getId())
                .candidateAuthUserId(candidateAuthUserId)
                .meetingLink(meetingLink)
                .status(InterviewBooking.BookingStatus.SCHEDULED)
                .build();
                
        InterviewBooking savedBooking = interviewBookingRepository.save(booking);

        // 7. Update Application Status
        app.setStatus(ApplicationStatus.INTERVIEW_SCHEDULED);
        applicationRepository.save(app);

        // 8. Send Notification
        try {
            String subject = "Interview Scheduled — " + jobTitle;
            String body = buildConfirmationEmail(app.getCandidateName(), jobTitle, slot.getStartTime(), slot.getEndTime(), meetingLink);
            notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                    .recipientEmail(app.getCandidateEmail())
                    .subject(subject)
                    .body(body)
                    .type("INTERVIEW_SCHEDULED")
                    .build());
            log.info("Sent interview confirmation email to {}", app.getCandidateEmail());
        } catch (Exception e) {
            log.error("Failed to send interview confirmation to {}: {}", app.getCandidateEmail(), e.getMessage());
        }

        return savedBooking;
    }
    
    private String buildConfirmationEmail(String candidateName, String jobTitle, LocalDateTime startTime, LocalDateTime endTime, String meetingLink) {
        String name = candidateName != null ? candidateName : "Candidate";
        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(name) + "</strong>,")
                + EmailTemplate.paragraph("Your interview for the <strong>" + EmailTemplate.escape(jobTitle) + "</strong> position has been successfully scheduled.")
                + EmailTemplate.detailBox("Interview Details", new String[][]{
                        {"Start Time", EmailTemplate.escape(startTime.toString())},
                        {"End Time", EmailTemplate.escape(endTime.toString())},
                        {"Meeting Link", "<a href=\"" + EmailTemplate.escape(meetingLink) + "\" style=\"color:#2563eb;text-decoration:underline;\">" + EmailTemplate.escape(meetingLink) + "</a>"}
                })
                + EmailTemplate.button(meetingLink, "Join Interview")
                + EmailTemplate.fallbackLink(meetingLink)
                + EmailTemplate.paragraph("We look forward to speaking with you.");
        return EmailTemplate.render("Interview Scheduled", content);
    }

    @Transactional
    public InterviewBooking completeBooking(UUID jobId, UUID bookingId, SubmitInterviewFeedbackRequest request, UUID recruiterAuthUserId, UUID orgId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }

        InterviewBooking booking = interviewBookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + bookingId));

        InterviewSlot slot = interviewSlotRepository.findById(booking.getSlotId())
                .orElseThrow(() -> new ResourceNotFoundException("Slot not found for booking."));

        if (!slot.getJobId().equals(jobId)) {
            throw new BadRequestException("Booking does not belong to this job.");
        }

        booking.setStatus(InterviewBooking.BookingStatus.COMPLETED);
        booking.setRating(request.getRating());
        booking.setFeedback(request.getFeedback());

        // store detailed interview metrics if provided
        booking.setTechnical(request.getTechnical());
        booking.setProblemSolving(request.getProblemSolving());
        booking.setCommunication(request.getCommunication());
        booking.setBehavioral(request.getBehavioral());
        booking.setCultureFit(request.getCultureFit());
        
        booking.setRecruiterSummary(request.getRecruiterSummary());
        booking.setStrengths(request.getStrengths());
        booking.setWeaknesses(request.getWeaknesses());
        booking.setHireRecommendation(request.getHireRecommendation());

        // Update the application status to INTERVIEW_COMPLETED
        Application app = applicationRepository.findById(booking.getApplicationId())
                .orElseThrow(() -> new ResourceNotFoundException("Application not found for booking: " + booking.getApplicationId()));
        app.setStatus(ApplicationStatus.INTERVIEW_COMPLETED);
        // Compute interview score according to weights provided by product:
        // Final (/50) = ((Technical*0.40) + (ProblemSolving*0.25) + (Communication*0.15) + (Behavioral*0.10) + (CultureFit*0.10)) * 5
        Integer tech = request.getTechnical() != null ? request.getTechnical() : 0;
        Integer prob = request.getProblemSolving() != null ? request.getProblemSolving() : 0;
        Integer comm = request.getCommunication() != null ? request.getCommunication() : 0;
        Integer beh = request.getBehavioral() != null ? request.getBehavioral() : 0;
        Integer cult = request.getCultureFit() != null ? request.getCultureFit() : 0;

        double weighted = (tech * 0.40) + (prob * 0.25) + (comm * 0.15) + (beh * 0.10) + (cult * 0.10);
        double finalInterviewScore = Math.round((weighted * 5.0) * 100.0) / 100.0; // round to 2 dp
        app.setInterviewScore(finalInterviewScore);
        booking.setFinalScore(finalInterviewScore);

        // Calculate final ranking score combining CV, OA, and Interview
        List<com.ats.jobs.entity.InterviewInvite> invites = interviewInviteRepository.findByJobIdAndCandidateAuthUserId(jobId, booking.getCandidateAuthUserId());
        if (!invites.isEmpty() && invites.get(0).getOaScore() != null) {
            app.setOaScore(invites.get(0).getOaScore());
        }

        double cvScore = app.getCompositeScore() != null ? app.getCompositeScore() : 0.0;
        double oaScore = app.getOaScore() != null ? app.getOaScore() : 0.0;
        // CV (100) + OA (100) + Interview (50*2=100) / 3
        double finalRankingScore = Math.round(((cvScore + oaScore + (finalInterviewScore * 2)) / 3.0) * 100.0) / 100.0;
        app.setFinalRankingScore(finalRankingScore);

        applicationRepository.save(app);

        // Update finalRank for all applications in this job
        List<Application> allApps = applicationRepository.findByJobId(jobId);
        allApps.sort((a, b) -> {
            double scoreA = a.getFinalRankingScore() != null ? a.getFinalRankingScore() : 0.0;
            double scoreB = b.getFinalRankingScore() != null ? b.getFinalRankingScore() : 0.0;
            return Double.compare(scoreB, scoreA); // descending
        });
        int rank = 1;
        for (Application a : allApps) {
            if (a.getFinalRankingScore() != null && a.getFinalRankingScore() > 0) {
                a.setFinalRank(rank++);
            }
        }
        applicationRepository.saveAll(allApps);

        InterviewBooking saved = interviewBookingRepository.save(booking);

        // Send post-interview thank you email
        try {
            String email = app.getCandidateEmail();
            if (email != null && !email.isBlank()) {
                String candidateName = app.getCandidateName() != null ? app.getCandidateName() : "Candidate";
                String subject = "Thank You for Your Interview — " + job.getTitle();
                String body = buildInterviewCompletionEmail(candidateName, job.getTitle());
                notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                        .recipientEmail(email)
                        .subject(subject)
                        .body(body)
                        .type("INTERVIEW_COMPLETED")
                        .build());
                log.info("Sent post-interview thank-you email to {}", email);
            }
        } catch (Exception e) {
            log.error("Failed to send post-interview email: {}", e.getMessage());
        }

        return saved;
    }

    private String buildInterviewCompletionEmail(String candidateName, String jobTitle) {
        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(candidateName) + "</strong>,")
                + EmailTemplate.paragraph("Thank you for taking the time to interview for the <strong>" + EmailTemplate.escape(jobTitle) + "</strong> position. It was a pleasure speaking with you and learning more about your background and experience.")
                + EmailTemplate.paragraph("Our team is currently reviewing all candidate interviews and will be in touch with you regarding the outcome as soon as possible. We appreciate your patience during this process.")
                + EmailTemplate.paragraph("Thank you again for your interest in joining our team.")
                + EmailTemplate.paragraph("Best regards,<br/><strong>The Recruitment Team</strong>");
        return EmailTemplate.render("Thank You for Interviewing", content);
    }

    @Transactional(readOnly = true)
    public List<CandidateBookingResponse> getCandidateBookings(UUID candidateAuthUserId) {
        List<InterviewBooking> bookings = interviewBookingRepository.findByCandidateAuthUserId(candidateAuthUserId);
        
        return bookings.stream().map(booking -> {
            InterviewSlot slot = interviewSlotRepository.findById(booking.getSlotId()).orElse(null);
            Job job = slot != null ? jobRepository.findById(slot.getJobId()).orElse(null) : null;
            
            return CandidateBookingResponse.builder()
                    .id(booking.getId())
                    .jobId(job != null ? job.getId() : null)
                    .jobTitle(job != null ? job.getTitle() : "Unknown Job")
                    .startTime(slot != null ? slot.getStartTime() : null)
                    .endTime(slot != null ? slot.getEndTime() : null)
                    .meetingLink(booking.getMeetingLink())
                    .status(booking.getStatus())
                    .build();
        }).toList();
    }
}
