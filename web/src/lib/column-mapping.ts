export type ColumnMapping = {
  nameHeader: string;
  phoneHeader: string;
  genderHeader: string;
  orderedProductHeader: string;
  internalResponseIdHeader: string;
};

export const defaultColumnMapping: ColumnMapping = {
  nameHeader: '이름',
  phoneHeader: '전화번호',
  genderHeader: '성별',
  orderedProductHeader: '주문 상품',
  internalResponseIdHeader: '_internal_response_id',
};

export const columnMappingLabels: Record<keyof ColumnMapping, string> = {
  nameHeader: '이름',
  phoneHeader: '전화번호',
  genderHeader: '성별',
  orderedProductHeader: '주문 상품',
  internalResponseIdHeader: '내부 ID',
};

/**
 * Header titles that are accepted for each field. Google Forms wording differs
 * between organisers, so common variants are matched automatically.
 */
export const columnAliases: Record<keyof ColumnMapping, readonly string[]> = {
  nameHeader: ['이름', '성명', '참가자명', '참가자', '이름(실명)', '성함', 'name'],
  phoneHeader: ['전화번호', '연락처', '휴대폰', '휴대전화', '핸드폰', '전화', 'phone'],
  genderHeader: ['성별', 'gender', 'sex'],
  orderedProductHeader: ['주문 상품', '주문상품', '상품', '주문항목', '주문 항목', 'product'],
  internalResponseIdHeader: ['_internal_response_id'],
};

const mappingKeys = Object.keys(defaultColumnMapping) as (keyof ColumnMapping)[];

export class ColumnMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ColumnMappingError';
  }
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Resolves the sheet headers for each field. An explicit preference wins when
 * it exists in the sheet; otherwise the first matching alias is used. Failing
 * loudly beats storing personal data in the wrong column.
 */
export function resolveColumnMapping(
  headers: string[],
  preferred: Partial<ColumnMapping> = {},
): ColumnMapping {
  const normalizedHeaders = new Map(headers.map((header) => [normalize(header), header]));
  const resolved = {} as ColumnMapping;
  const missing: string[] = [];

  for (const key of mappingKeys) {
    const preferredValue = preferred[key];

    if (preferredValue && normalizedHeaders.has(normalize(preferredValue))) {
      resolved[key] = normalizedHeaders.get(normalize(preferredValue)) as string;
      continue;
    }

    const matched = columnAliases[key]
      .map((alias) => normalizedHeaders.get(normalize(alias)))
      .find((header): header is string => Boolean(header));

    if (matched) {
      resolved[key] = matched;
      continue;
    }

    missing.push(columnMappingLabels[key]);
  }

  if (missing.length > 0) {
    throw new ColumnMappingError(
      `다음 항목의 컬럼을 찾지 못했습니다: ${missing.join(', ')}. ` +
        `시트 헤더: ${headers.filter(Boolean).join(', ') || '(없음)'}. ` +
        'Sheets 설정에서 컬럼 이름을 직접 지정하세요.',
    );
  }

  return resolved;
}

/**
 * Verifies the stored mapping still matches the sheet. A renamed or removed
 * column must fail the sync instead of writing the wrong data.
 */
export function assertMappingPresent(headers: string[], mapping: ColumnMapping) {
  const normalizedHeaders = new Set(headers.map(normalize));
  const missing = mappingKeys.filter((key) => !normalizedHeaders.has(normalize(mapping[key])));

  if (missing.length > 0) {
    throw new ColumnMappingError(
      `저장된 컬럼 매핑과 시트 헤더가 다릅니다: ${missing
        .map((key) => `${columnMappingLabels[key]}(${mapping[key]})`)
        .join(', ')}. Sheets 설정에서 연결을 다시 저장하세요.`,
    );
  }
}
