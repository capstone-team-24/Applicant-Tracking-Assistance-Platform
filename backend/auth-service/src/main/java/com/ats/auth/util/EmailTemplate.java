package com.ats.auth.util;

public final class EmailTemplate {

    private EmailTemplate() {}

    public static String render(String title, String bodyContent) {
        return render(title, bodyContent, null);
    }

    public static String render(String title, String bodyContent, String footerNote) {
        String footer = footerNote != null && !footerNote.isBlank()
                ? "<p style=\"margin:0 0 8px;font-size:12px;color:#6b7280;text-align:center;line-height:1.6;\">" + footerNote + "</p>"
                : "";

        return "<!DOCTYPE html>" +
                "<html lang=\"en\"><head><meta charset=\"UTF-8\">" +
                "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>" +
                "<body style=\"margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;\">" +
                "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" style=\"background:#f3f4f6;\">" +
                "<tr><td align=\"center\" style=\"padding:40px 16px;\">" +
                "<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" data-email-template=\"ats-blue\" " +
                "style=\"max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);\">" +
                "<tr><td style=\"background:#2563eb;padding:28px 36px;\">" +
                "<p style=\"margin:0;font-size:13px;color:#bfdbfe;letter-spacing:.5px;text-transform:uppercase;\">ATS Recruitment</p>" +
                "<h1 style=\"margin:6px 0 0;font-size:22px;color:#ffffff;font-weight:700;\">" + escape(title) + "</h1>" +
                "</td></tr>" +
                "<tr><td style=\"padding:36px 36px 28px;\">" +
                bodyContent +
                "<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px;\">" +
                footer +
                "<p style=\"font-size:12px;color:#9ca3af;text-align:center;margin:0;\">This message was sent by the ATS Recruitment System.</p>" +
                "</td></tr>" +
                "</table>" +
                "</td></tr></table>" +
                "</body></html>";
    }

    public static String paragraph(String content) {
        return "<p style=\"margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;\">" + content + "</p>";
    }

    public static String button(String url, String label) {
        return "<div style=\"text-align:center;margin:28px 0;\">" +
                "<a href=\"" + escapeAttribute(url) + "\" target=\"_blank\" " +
                "style=\"display:inline-block;background:#2563eb;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;\">" +
                escape(label) +
                "</a></div>";
    }

    public static String fallbackLink(String url) {
        return "<p style=\"font-size:13px;color:#6b7280;margin:0 0 6px;\">If the button does not work, copy and paste this link into your browser:</p>" +
                "<p style=\"font-size:13px;color:#2563eb;word-break:break-all;margin:0 0 24px;\">" + escape(url) + "</p>";
    }

    public static String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#x27;");
    }

    private static String escapeAttribute(String value) {
        return escape(value);
    }
}
