import styled, { keyframes } from "styled-components";
import { useRef, useState, useEffect } from "react";

const scan = keyframes`
  0% { top: 10%; }
  50% { top: 70%; }
  100% { top: 10%; }
`;

const dataFlow = keyframes`
  0% { transform: translateY(0); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateY(-40px); opacity: 0; }
`;

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

export function BentoGrid() {
  const { ref, visible } = useInView();

  return (
    <Section id="features" ref={ref}>
      <Container>
        <Label $visible={visible}>Capabilities</Label>
        <SectionTitle $visible={visible}>
          Everything your agent needs
          <br />
          to work with Reddit
        </SectionTitle>

        <Grid>
          {/* Fetch subreddit — large card */}
          <BentoCard $span="large" $visible={visible} $index={0}>
            <BentoContent>
              <CardCommand>
                <CommandPrompt>&gt;</CommandPrompt> fetch_subreddit("r/startup")
              </CardCommand>
              <BentoTitle>Get latest posts in subreddit</BentoTitle>
              <BentoDesc>
                Fetch structured post data from any subreddit — titles, scores,
                comment counts, URLs. Sort by hot, new, top, or rising.
              </BentoDesc>
            </BentoContent>
            <CardIllustration>
              <DataPreview>
                <DataLine>
                  <DataKey>"title"</DataKey>:{" "}
                  <DataString>"Best AI tools for..."</DataString>
                </DataLine>
                <DataLine>
                  <DataKey>"score"</DataKey>: <DataNum>847</DataNum>
                </DataLine>
                <DataLine>
                  <DataKey>"comments"</DataKey>: <DataNum>156</DataNum>
                </DataLine>
                <DataLine>
                  <DataKey>"subreddit"</DataKey>:{" "}
                  <DataString>"r/entrepreneur"</DataString>
                </DataLine>
              </DataPreview>
              <DataFlowDot $delay={0} />
              <DataFlowDot $delay={1} />
              <DataFlowDot $delay={2} />
            </CardIllustration>
          </BentoCard>

          {/* Search Reddit */}
          <BentoCard $span="small" $visible={visible} $index={1}>
            <BentoContent>
              <CardCommand>
                <CommandPrompt>&gt;</CommandPrompt> search_reddit("AI tools 2025")
              </CardCommand>
              <BentoTitle>Search Reddit for anything</BentoTitle>
              <BentoDesc>
                Full-text search across all of Reddit. Filter by subreddit,
                time range, and sort. Clean, structured results.
              </BentoDesc>
            </BentoContent>
            <SearchIllustration>
              <SearchBar>
                <SearchIcon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                </SearchIcon>
                <SearchText>AI tools 2025</SearchText>
              </SearchBar>
              <ResultCount>
                <ResultDot />
                25 results found
              </ResultCount>
            </SearchIllustration>
          </BentoCard>

          {/* Reply to comment */}
          <BentoCard $span="small" $visible={visible} $index={2}>
            <BentoContent>
              <CardCommand>
                <CommandPrompt>&gt;</CommandPrompt> reply_to_comment(url, "Great insight!")
              </CardCommand>
              <BentoTitle>Post comments under any thread</BentoTitle>
              <BentoDesc>
                Reply to posts and comments using your own Reddit session.
                Your AI agent can engage in conversations authentically.
              </BentoDesc>
            </BentoContent>
            <CommentIllustration>
              <CommentBubble>
                <CommentUser>u/your_account</CommentUser>
                <CommentText>Great insight!</CommentText>
              </CommentBubble>
              <ScanLine />
            </CommentIllustration>
          </BentoCard>

          {/* Session — wide card */}
          <BentoCard $span="wide" $visible={visible} $index={3}>
            <BentoContent>
              <BentoTitle>Your own login session</BentoTitle>
              <BentoDesc>
                Uses your actual Reddit account in Chrome. No shared proxies, no
                fake accounts, no API keys to rotate. No captchas — ever.
              </BentoDesc>
            </BentoContent>
            <SessionIllustration>
              <SessionCard>
                <SessionAvatar>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </SessionAvatar>
                <SessionDetails>
                  <SessionName>u/your_account</SessionName>
                  <SessionStatus>
                    <GreenDot /> Logged in via Chrome
                  </SessionStatus>
                </SessionDetails>
                <SessionBadge>Active</SessionBadge>
              </SessionCard>
            </SessionIllustration>
          </BentoCard>
        </Grid>
      </Container>
    </Section>
  );
}

const Section = styled.section`
  position: relative;
  padding: var(--section-gap) var(--container-padding);
`;

const Container = styled.div`
  max-width: var(--container-max);
  margin: 0 auto;
`;

const Label = styled.p<{ $visible: boolean }>`
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  margin-bottom: 12px;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 16)}px);
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
`;

const SectionTitle = styled.h2<{ $visible: boolean }>`
  font-size: clamp(2rem, 4.5vw, 3rem);
  margin-bottom: 56px;
  max-width: 600px;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 24)}px);
  transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const BentoCard = styled.div<{
  $span: "large" | "small" | "wide";
  $visible: boolean;
  $index: number;
}>`
  position: relative;
  overflow: hidden;
  padding: 32px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-panel);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 280px;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 30)}px);
  transition:
    opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${(p) => 0.1 + p.$index * 0.1}s,
    transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${(p) => 0.1 + p.$index * 0.1}s,
    border-color var(--transition-fast);

  ${(p) =>
    p.$span === "large" &&
    `
    grid-column: span 2;
    flex-direction: row;
    gap: 40px;
    @media (max-width: 768px) {
      grid-column: span 1;
      flex-direction: column;
    }
  `}

  ${(p) =>
    p.$span === "wide" &&
    `
    grid-column: span 2;
    flex-direction: row;
    align-items: center;
    gap: 40px;
    min-height: auto;
    padding: 28px 32px;
    @media (max-width: 768px) {
      grid-column: span 1;
      flex-direction: column;
    }
  `}

  &:hover {
    border-color: var(--border-hover);
  }
`;

const BentoContent = styled.div`
  flex: 1;
`;

const BentoTitle = styled.h3`
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
`;

const BentoDesc = styled.p`
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.65;
  max-width: 400px;
`;

const CardCommand = styled.div`
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  padding: 6px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: inline-block;
  margin-bottom: 16px;
`;

const CommandPrompt = styled.span`
  color: var(--accent);
`;

/* Data illustration */
const CardIllustration = styled.div`
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  min-width: 260px;
`;

const DataPreview = styled.div`
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.8;
  padding: 14px 18px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  width: 100%;
`;

const DataLine = styled.div``;

const DataKey = styled.span`
  color: var(--accent);
`;

const DataString = styled.span`
  color: #059669;
`;

const DataNum = styled.span`
  color: #7c3aed;
`;

const DataFlowDot = styled.div<{ $delay: number }>`
  position: absolute;
  right: 12px;
  bottom: 20px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0;
  animation: ${dataFlow} 2s ease-in-out infinite;
  animation-delay: ${(p) => p.$delay * 0.6}s;
`;

/* Search illustration */
const SearchIllustration = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
`;

const SearchIcon = styled.span`
  color: var(--text-muted);
  display: flex;
`;

const SearchText = styled.span`
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
`;

const ResultCount = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  padding: 0 4px;
`;

const ResultDot = styled.span`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
`;

/* Comment illustration */
const CommentIllustration = styled.div`
  position: relative;
  margin-top: 20px;
`;

const CommentBubble = styled.div`
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
`;

const CommentUser = styled.div`
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
  margin-bottom: 4px;
`;

const CommentText = styled.div`
  font-size: 13px;
  color: var(--text-secondary);
`;

const ScanLine = styled.div`
  position: absolute;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.3;
  animation: ${scan} 3s ease-in-out infinite;
`;

/* Session illustration */
const SessionIllustration = styled.div`
  flex-shrink: 0;
`;

const SessionCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  min-width: 280px;
`;

const SessionAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--accent-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  flex-shrink: 0;
`;

const SessionDetails = styled.div`
  flex: 1;
`;

const SessionName = styled.div`
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
`;

const SessionStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--accent);
  margin-top: 2px;
`;

const GreenDot = styled.span`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
`;

const SessionBadge = styled.span`
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 100px;
  background: var(--accent-subtle);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;
