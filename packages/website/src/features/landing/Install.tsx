import styled, { keyframes } from "styled-components";
import { useState } from "react";
import skillDocs from "../../../SKILL.md?raw";

export function Install() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(skillDocs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Page>
      <Container>
        <Header>
          <LogoIcon>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <circle cx="8.5" cy="10" r="1.2" fill="var(--accent)" stroke="none" />
              <circle cx="15.5" cy="10" r="1.2" fill="var(--accent)" stroke="none" />
              <path d="M8.5 14.5 Q12 17 15.5 14.5" strokeLinecap="round" fill="none" />
            </svg>
          </LogoIcon>
          <Title>reddit_claw</Title>
        </Header>

        <Subtitle>
          Copy the skill definition below and paste it into your agent chat to
          get started.
        </Subtitle>

        <CopyBar>
          <CopyLabel>SKILL.md</CopyLabel>
          <CopyButton onClick={handleCopy}>
            {copied ? "Copied!" : "Copy to Clipboard"}
          </CopyButton>
        </CopyBar>

        <CodeBlock>
          <Pre>{skillDocs}</Pre>
        </CodeBlock>
      </Container>
    </Page>
  );
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Page = styled.div`
  min-height: 100vh;
  padding: 80px var(--container-padding) 60px;
`;

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  animation: ${fadeIn} 0.6s cubic-bezier(0.16, 1, 0.3, 1);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const LogoIcon = styled.span`
  display: flex;
  align-items: center;
`;

const Title = styled.h1`
  font-family: var(--font-mono);
  font-size: 1.5rem;
  color: var(--text-primary);
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 32px;
  line-height: 1.6;
`;

const CopyBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
`;

const CopyLabel = styled.span`
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
`;

const CopyButton = styled.button`
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  background: var(--accent);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px var(--accent-glow);
    background: var(--accent-light);
  }
`;

const CodeBlock = styled.div`
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  overflow: auto;
  max-height: 70vh;
  box-shadow: var(--shadow-panel);
`;

const Pre = styled.pre`
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  padding: 20px 24px;
  white-space: pre-wrap;
  word-break: break-word;
`;
