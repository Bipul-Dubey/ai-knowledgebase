package utils

import (
	"fmt"
	"net/smtp"
	"os"
)

// EmailSender handles sending emails through SMTP
type EmailSender struct {
	from     string
	password string
	host     string
	port     string
}

// NewEmailSender creates a new instance using environment variables
func NewEmailSender() *EmailSender {
	return &EmailSender{
		from:     os.Getenv("SMTP_USER"),
		password: os.Getenv("SMTP_PASSWORD"),
		host:     os.Getenv("SMTP_HOST"),
		port:     os.Getenv("SMTP_PORT"),
	}
}

// SendEmail sends an HTML email with subject and body
func (s *EmailSender) SendEmail(to, subject, body string) error {
	if s.host == "" || s.port == "" || s.from == "" || s.password == "" {
		return fmt.Errorf("missing SMTP configuration")
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
