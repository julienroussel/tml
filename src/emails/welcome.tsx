import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface WelcomeEmailProps {
  appUrl?: string;
  body: string;
  cta: string;
  featureImprove: string;
  featurePerform: string;
  featurePlan: string;
  footerText: string;
  greeting: string;
  preview: string;
}

const DEFAULT_APP_URL = "https://themagiclab.app";

/** Default props shown in the React Email preview UI. */
WelcomeEmail.PreviewProps = {
  appUrl: DEFAULT_APP_URL,
  body: "Your workspace is ready. Here's what you can do:",
  cta: "Go to your dashboard",
  featureImprove: "Log practice sessions and track progress",
  featurePlan: "Build and organize routines",
  featurePerform: "Record and review performances",
  footerText: "— The Magic Lab",
  greeting: "Hi Houdini, welcome to The Magic Lab!",
  preview: "Your workspace is ready — start organizing your magic.",
} satisfies WelcomeEmailProps;

export default function WelcomeEmail({
  appUrl = DEFAULT_APP_URL,
  body,
  cta,
  featureImprove,
  featurePlan,
  featurePerform,
  footerText,
  greeting,
  preview,
}: WelcomeEmailProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={container}>
          <Section style={logoSection}>
            <Link href={appUrl}>
              <Img
                alt="The Magic Lab"
                height={50}
                src={`${appUrl}/logo-email.png`}
                style={logoImg}
                width={150}
              />
            </Link>
          </Section>
          <Heading style={headingStyle}>{greeting}</Heading>
          <Text style={textStyle}>{body}</Text>
          <Text style={listItem}>
            <strong>Improve</strong> — {featureImprove}
          </Text>
          <Text style={listItem}>
            <strong>Plan</strong> — {featurePlan}
          </Text>
          <Text style={listItem}>
            <strong>Perform</strong> — {featurePerform}
          </Text>
          <Link href={`${appUrl}/dashboard`} style={buttonStyle}>
            {cta}
          </Link>
          <Text style={footerStyle}>{footerText}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const logoSection: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "24px",
};

const logoImg: React.CSSProperties = {
  display: "inline-block",
};

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: "0",
  padding: "0",
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  margin: "40px auto",
  maxWidth: "480px",
  padding: "32px 24px",
};

const headingStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.3",
  margin: "0 0 16px",
};

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "1.5",
  margin: "0 0 16px",
};

const listItem: React.CSSProperties = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "1.5",
  margin: "0 0 8px",
  paddingLeft: "8px",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#7c3aed",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "500",
  margin: "16px 0",
  padding: "12px 24px",
  textDecoration: "none",
};

const footerStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
  marginTop: "24px",
};
