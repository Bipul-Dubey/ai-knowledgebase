package utils

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
	"regexp"
	"strings"
)

// EmailSender sends mail over SMTP, or logs it in development.
type EmailSender struct {
	from     string
	password string
	host     string
	port     string
	logOnly  bool
}

// isDevelopment reports a development run. ENV is the single dev-mode switch
// across the stack. Only the exact value "development" counts, so a deployed
// service never silently swallows its mail.
func isDevelopment() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("ENV")), "development")
}

// NewEmailSender creates a new instance using environment variables
func NewEmailSender() *EmailSender {
	return &EmailSender{
		from:     os.Getenv("SMTP_USER"),
		password: os.Getenv("SMTP_PASSWORD"),
		host:     os.Getenv("SMTP_HOST"),
		port:     os.Getenv("SMTP_PORT"),
		logOnly:  isDevelopment(),
	}
}

// hrefPattern extracts the action links -- the only part of these emails
// anyone needs in development.
var hrefPattern = regexp.MustCompile(`href=["']([^"']+)["']`)

// SendEmail sends an HTML email with subject and body
func (s *EmailSender) SendEmail(to, subject, body string) error {
	if s.logOnly {
		s.logEmail(to, subject, body)
		return nil
	}

	if s.host == "" || s.port == "" || s.from == "" || s.password == "" {
		return fmt.Errorf(
			"missing SMTP configuration (set SMTP_USER/SMTP_PASSWORD/SMTP_HOST/SMTP_PORT, " +
				"or set ENV=development to write mail to the log instead)")
	}

	// Compose the email message (with Subject + HTML Body)
	msg := []byte(fmt.Sprintf(
		"From: %s\r\n"+
			"To: %s\r\n"+
			"Subject: %s\r\n"+
			"MIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=\"utf-8\"\r\n"+
			"\r\n%s\r\n",
		s.from, to, subject, body,
	))

	auth := smtp.PlainAuth("", s.from, s.password, s.host)
	return smtp.SendMail(s.host+":"+s.port, auth, s.from, []string{to}, msg)
}

// logEmail logs the email instead of sending it. Fixed [EMAIL] prefix, so:
// docker compose logs users-service | grep EMAIL
func (s *EmailSender) logEmail(to, subject, body string) {
	var b strings.Builder

	b.WriteString("\n[EMAIL] not sent - ENV=development\n")
	b.WriteString(fmt.Sprintf("[EMAIL]   to:      %s\n", to))
	b.WriteString(fmt.Sprintf("[EMAIL]   subject: %s\n", subject))

	for _, m := range hrefPattern.FindAllStringSubmatch(body, -1) {
		b.WriteString(fmt.Sprintf("[EMAIL]   link:    %s\n", m[1]))
	}

	log.Print(b.String())
}
