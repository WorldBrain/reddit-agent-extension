import styled from "styled-components";
import { useRef, useState, useEffect } from "react";

function useInView(threshold = 0.15) {
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

const CHANGES = [
  "Fetch structured post data from any subreddit — titles, scores, comments, URLs",
  "Full-text search across all of Reddit with time range and sort filters",
  "Post comments and replies using your own authenticated browser session",
  "No API keys required — uses your actual Chrome login session",
  "Zero captcha blocks — you browse as a real, authenticated user",
  "Clean JSON output ready for any AI agent to process",
  "Bridge server included — connects OpenClaw to your extension",
  "One-time purchase, lifetime access — no subscriptions or per-request fees",
];

export function Features() {
  const { ref, visible } = useInView();

  return (
    <Section id="features" ref={ref}>
      <Container>
        <Grid>
          <LeftCol $visible={visible}>
            <ChangelogLabel>Changelog</ChangelogLabel>
            <VersionMeta>
              <MetaLine>
                <MetaKey>version</MetaKey>
                <MetaVal>2.0.0</MetaVal>
              </MetaLine>
              <MetaLine>
                <MetaKey>released</MetaKey>
                <MetaVal>2025-06-01</MetaVal>
              </MetaLine>
              <MetaLine>
                <MetaKey>license</MetaKey>
                <MetaVal>lifetime</MetaVal>
              </MetaLine>
            </VersionMeta>
          </LeftCol>

          <Divider />

          <RightCol $visible={visible}>
            <ReleaseTitle>What's new in reddit_claw v2.0</ReleaseTitle>
            <ChangeList>
              {CHANGES.map((change, i) => (
                <ChangeItem key={i} $visible={visible} $index={i}>
                  <ChangeBullet>+</ChangeBullet>
                  <ChangeText>{change}</ChangeText>
                </ChangeItem>
              ))}
            </ChangeList>
          </RightCol>
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

const Grid = styled.div`
  display: grid;
  grid-template-columns: 300px 1px 1fr;
  gap: 48px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 48px;
  box-shadow: var(--shadow-panel);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 32px;
    padding: 32px;
  }
`;

const LeftCol = styled.div<{ $visible: boolean }>`
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 16)}px);
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
`;

const ChangelogLabel = styled.h3`
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin-bottom: 24px;
`;

const VersionMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const MetaLine = styled.div`
  display: flex;
  gap: 12px;
  align-items: baseline;
`;

const MetaKey = styled.span`
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  min-width: 60px;
`;

const MetaVal = styled.span`
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
`;

const Divider = styled.div`
  background: var(--border);
  width: 1px;

  @media (max-width: 768px) {
    width: 100%;
    height: 1px;
  }
`;

const RightCol = styled.div<{ $visible: boolean }>`
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 20)}px);
  transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
`;

const ReleaseTitle = styled.h2`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 28px;
  color: var(--text-primary);
`;

const ChangeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ChangeItem = styled.div<{ $visible: boolean; $index: number }>`
  display: flex;
  gap: 10px;
  align-items: baseline;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateX(${(p) => (p.$visible ? 0 : 12)}px);
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${(p) => 0.2 + p.$index * 0.06}s;
`;

const ChangeBullet = styled.span`
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  flex-shrink: 0;
`;

const ChangeText = styled.span`
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
`;
