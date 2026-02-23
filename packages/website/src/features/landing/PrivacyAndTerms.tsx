import styled, { keyframes } from "styled-components";

export function PrivacyAndTermsPage() {
  return (
    <Page>
      <Container>
        <Header>
          <HeaderTitle>Privacy Policy & Terms of Service</HeaderTitle>
          <Subtitle>
            Effective date: [INSERT EFFECTIVE DATE]
          </Subtitle>
        </Header>

        <Lead>
          This Privacy Policy and Terms of Service applies to the use of reddit_claw
          and explains how we handle data and govern service use.
        </Lead>

        <Panel>
          <SectionTitle>Company Information</SectionTitle>
          <Paragraph>
            reddit_claw<br />
            Literary Machines
            <br />
            2099 Philadelphia Pike #9861
            <br />
            Claymont
            <br />
            19703, US
          </Paragraph>
          <SectionTitle>Contact</SectionTitle>
          <Paragraph>support@reddit_claw.com</Paragraph>
        </Panel>

        <Panel>
          <SectionTitle>1. Privacy Policy</SectionTitle>
          <SectionHeading>1.1 Information We Collect</SectionHeading>
          <Paragraph>
            We collect information you provide directly (for example, when you
            contact support), account-related details needed to process
            subscriptions or payments, and automatically collected usage data for
            improving product reliability.
          </Paragraph>
          <SectionHeading>1.2 Zero Personal Data Policy</SectionHeading>
          <Paragraph>
            We do not collect, store, or sell your Reddit browsing data, AI
            prompts, extension activity logs, or browser content for our own
            analysis. Our service acts as a direct bridge between OpenClaw and
            your browser extension. That means we do not build profiles or keep
            long-term records of your personal use data in our systems.
          </Paragraph>
          <SectionHeading>1.3 How We Use Information</SectionHeading>
          <Paragraph>
            We use data to deliver and secure the service, process purchases, send
            transactional updates, improve product quality, and comply with legal
            obligations.
          </Paragraph>
          <SectionHeading>1.4 Third Parties</SectionHeading>
          <Paragraph>
            We may share limited data with service providers that support hosting,
            payment processing, analytics, and customer support. These providers
            process data on our behalf and are contractually required to protect it.
          </Paragraph>
          <SectionHeading>1.5 Data Retention</SectionHeading>
          <Paragraph>
            We retain personal data only as long as necessary for the purposes
            described above, for legal compliance, and for resolving disputes.
          </Paragraph>
          <SectionHeading>1.6 Your Rights</SectionHeading>
          <Paragraph>
            Depending on your location, you may have rights to access, update,
            delete, or restrict use of your personal data. You may also request
            a copy of your data or object to certain processing.
          </Paragraph>
        </Panel>

        <Panel>
          <SectionTitle>2. Terms of Service</SectionTitle>
          <SectionHeading>2.1 Use of Service</SectionHeading>
          <Paragraph>
            You agree to use reddit_claw lawfully and in a manner that does not
            harm the service, other users, or third-party platforms you connect to.
          </Paragraph>
          <SectionHeading>2.2 Accounts and Billing</SectionHeading>
          <Paragraph>
            If you purchase a subscription, you are responsible for maintaining
            your payment details and for all activity under your account.
          </Paragraph>
          <SectionHeading>2.3 Acceptable Use</SectionHeading>
          <Paragraph>
            You may not use the service for fraud, abuse, unauthorized access,
            scraping in violation of platform rules, or other unlawful conduct.
          </Paragraph>
          <SectionHeading>2.4 Availability</SectionHeading>
          <Paragraph>
            We may change, suspend, or discontinue features with reasonable
            notice when necessary for maintenance, security, or platform changes.
          </Paragraph>
          <SectionHeading>2.5 Limitation of Liability</SectionHeading>
          <Paragraph>
            To the fullest extent permitted by law, reddit_claw is not liable for
            indirect or consequential losses, and its total liability is limited to
            the amount paid by you for the service in the preceding 12 months.
          </Paragraph>
          <SectionHeading>2.6 Changes to Terms</SectionHeading>
          <Paragraph>
            We may update these Terms and Privacy Policy from time to time. Updates
            become effective when posted with the revised effective date.
          </Paragraph>
        </Panel>

        <BackLink href="/">← Back to home</BackLink>
      </Container>
    </Page>
  );
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Page = styled.main`
  min-height: 100vh;
  padding: 80px var(--container-padding) 80px;
  animation: ${fadeIn} 0.45s var(--transition-base) both;
`;

const Container = styled.div`
  max-width: 860px;
  margin: 0 auto;
`;

const Header = styled.header`
  margin-bottom: 24px;
`;

const HeaderTitle = styled.h1`
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  margin-bottom: 10px;
`;

const Subtitle = styled.p`
  font-size: 13px;
  color: var(--text-secondary);
`;

const Lead = styled.p`
  margin-bottom: 24px;
  color: var(--text-secondary);
  line-height: 1.7;
`;

const Panel = styled.section`
  padding: 22px;
  margin-bottom: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
`;

const SectionTitle = styled.h2`
  font-size: 1.35rem;
  margin-bottom: 16px;
`;

const SectionHeading = styled.h3`
  font-size: 1rem;
  margin: 16px 0 8px;
  font-weight: 600;
  color: var(--text-primary);
`;

const Paragraph = styled.p`
  margin: 0 0 10px;
  color: var(--text-secondary);
  line-height: 1.7;
`;

const BackLink = styled.a`
  display: inline-flex;
  margin-top: 6px;
  color: var(--accent);
  font-size: 14px;

  &:hover {
    text-decoration: underline;
  }
`;
