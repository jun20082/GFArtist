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

/**
 * The internal id column is created by the server during sync, so it must not
 * be required to exist in the sheet when the connection is saved.
 */
const requiredAtConnectKeys = mappingKeys.filter((key) => key !== 'internalResponseIdHeader');

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
 * Resolves the sheet headers for each field. An empty field uses the first
 * matching alias. A field the manager typed explicitly must exist in the sheet:
 * silently swapping a typo for another column would hide the mistake.
 */
export function resolveColumnMapping(
  headers: string[],
  preferred: Partial<ColumnMapping> = {},
): ColumnMapping {
  const normalizedHeaders = new Map(headers.map((header) => [normalize(header), header]));
  const resolved = {} as ColumnMapping;
  const unknown: string[] = [];
  const missing: string[] = [];

  for (const key of requiredAtConnectKeys) {
    const preferredValue = preferred[key]?.trim();

    if (preferredValue) {
      const matched = normalizedHeaders.get(normalize(preferredValue));

      if (matched) {
        resolved[key] = matched;
      } else {
        unknown.push(`${columnMappingLabels[key]}(${preferredValue})`);
      }

      continue;
    }

    const aliasMatch = columnAliases[key]
      .map((alias) => normalizedHeaders.get(normalize(alias)))
      .find((header): header is string => Boolean(header));

    if (aliasMatch) {
      resolved[key] = aliasMatch;
      continue;
    }

    missing.push(columnMappingLabels[key]);
  }

  const preferredId = preferred.internalResponseIdHeader?.trim();
  const idMatch = preferredId
    ? normalizedHeaders.get(normalize(preferredId)) ?? preferredId
    : columnAliases.internalResponseIdHeader
        .map((alias) => normalizedHeaders.get(normalize(alias)))
        .find((header): header is string => Boolean(header));

  resolved.internalResponseIdHeader = idMatch ?? defaultColumnMapping.internalResponseIdHeader;

  if (unknown.length > 0 || missing.length > 0) {
    const reasons: string[] = [];

    if (unknown.length > 0) {
      reasons.push(
        `지정한 컬럼을 시트에서 찾지 못했습니다: ${unknown.join(', ')}. ` +
          '자동 인식하려면 해당 칸을 비우세요.',
      );
    }

    if (missing.length > 0) {
      reasons.push(`다음 항목의 컬럼을 찾지 못했습니다: ${missing.join(', ')}.`);
    }

    reasons.push(`시트 헤더: ${headers.filter(Boolean).join(', ') || '(없음)'}`);

    throw new ColumnMappingError(reasons.join(' '));
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

/** Columns the respondent fills in. The internal id column is created by the server. */
export const respondentMappingKeys = [
  'nameHeader',
  'phoneHeader',
  'genderHeader',
  'orderedProductHeader',
] as const;

/**
 * The internal id column may be absent because the server creates it. Every
 * other mapped column must exist.
 */
export function assertRespondentMappingPresent(headers: string[], mapping: ColumnMapping) {
  const normalizedHeaders = new Set(headers.map(normalize));
  const missing = respondentMappingKeys.filter(
    (key) => !normalizedHeaders.has(normalize(mapping[key])),
  );

  if (missing.length > 0) {
    throw new ColumnMappingError(
      `저장된 컬럼 매핑과 시트 헤더가 다릅니다: ${missing
        .map((key) => `${columnMappingLabels[key]}(${mapping[key]})`)
        .join(', ')}. Sheets 설정에서 연결을 다시 저장하세요.`,
    );
  }
}
