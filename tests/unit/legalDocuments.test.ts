import { isLegalDocumentId, legalDocuments } from '@/legal/documents';

describe('legal documents', () => {
  it.each(['privacy', 'terms'] as const)('%s 문서를 앱에서 표시할 수 있는 형태로 제공한다', (id) => {
    const document = legalDocuments[id];

    expect(document.title).toBeTruthy();
    expect(document.summary).toBeTruthy();
    expect(document.announcedAt).toMatch(/^\d{4}년 \d{1,2}월 \d{1,2}일$/);
    expect(document.effectiveAt).toMatch(/^\d{4}년 \d{1,2}월 \d{1,2}일$/);
    expect(document.sections.length).toBeGreaterThanOrEqual(10);
    expect(document.sections.every((section) => section.title.length > 0)).toBe(true);
  });

  it('지원하는 문서 경로만 허용한다', () => {
    expect(isLegalDocumentId('privacy')).toBe(true);
    expect(isLegalDocumentId('terms')).toBe(true);
    expect(isLegalDocumentId('unknown')).toBe(false);
  });

  it('외부 사업자 정책 링크는 보안 연결을 사용한다', () => {
    const links = legalDocuments.privacy.sections.flatMap((section) => section.links ?? []);

    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.url.startsWith('https://'))).toBe(true);
  });
});
