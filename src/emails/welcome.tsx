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
  name?: string;
}

const DEFAULT_APP_URL = "https://themagiclab.app";

/** Default props shown in the React Email preview UI. */
WelcomeEmail.PreviewProps = {
  appUrl: DEFAULT_APP_URL,
  name: "Houdini",
} satisfies WelcomeEmailProps;

export default function WelcomeEmail({
  appUrl = DEFAULT_APP_URL,
  name,
}: WelcomeEmailProps): React.JSX.Element {
  const greeting = name ? `Hi ${name}` : "Hi";

  return (
    <Html>
      <Head />
      <Preview>Your workspace is ready — start organizing your magic.</Preview>
      <Body style={body}>
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
          <Heading style={heading}>
            {greeting}, welcome to The Magic Lab!
          </Heading>
          <Text style={text}>
            Your workspace is ready. Here&apos;s what you can do:
          </Text>
          <Text style={listItem}>
            <strong>Improve</strong> — Log practice sessions and track progress
          </Text>
          <Text style={listItem}>
            <strong>Plan</strong> — Build and organize routines
          </Text>
          <Text style={listItem}>
            <strong>Perform</strong> — Record and review performances
          </Text>
          <Link href={`${appUrl}/dashboard`} style={button}>
            Go to your dashboard
          </Link>
          <Text style={footer}>— The Magic Lab</Text>
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

const body: React.CSSProperties = {
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

const heading: React.CSSProperties = {
  color: "#111827",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.3",
  margin: "0 0 16px",
};

const text: React.CSSProperties = {
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

const button: React.CSSProperties = {
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

const footer: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
  marginTop: "24px",
};
