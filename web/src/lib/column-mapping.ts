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

/** Name and phone drive search and operating status, so they must exist. */
const requiredMappingKeys = ['nameHeader', 'phoneHeader'] as const;

/** Gender and product are optional; a sheet without them resolves to ''. */
const optionalMappingKeys = ['genderHeader', 'orderedProductHeader'] as const;

const connectMappingKeys: (keyof ColumnMapping)[] = [
  ...requiredMappingKeys,
  ...optionalMappingKeys,
];

function isRequiredMappingKey(key: keyof ColumnMapping) {
  return requiredMappingKeys.includes(key as (typeof requiredMappingKeys)[number]);
}

/** Sentinel for an optional column the user chose to leave unmapped. */
export const unmappedColumnValue = '__none__';

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

  for (const key of connectMappingKeys) {
    const preferredValue = preferred[key]?.trim();

    if (preferredValue) {
      if (preferredValue === unmappedColumnValue && !isRequiredMappingKey(key)) {
        resolved[key] = '';
        continue;
      }

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

    if (isRequiredMappingKey(key)) {
      missing.push(columnMappingLabels[key]);
    } else {
      resolved[key] = '';
    }
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

/** Columns the respondent fills in. The internal id column is created by the server. */
export const respondentMappingKeys = [
  'nameHeader',
  'phoneHeader',
  'genderHeader',
  'orderedProductHeader',
] as const;

/**
 * Resolves the extra columns the user selected to store and display. Every
 * selected header must still exist, and the original header casing is kept.
 */
export function resolveDisplayColumns(headers: string[], preferred: readonly string[] = []) {
  const normalizedHeaders = new Map(headers.map((header) => [normalize(header), header]));
  const resolved: string[] = [];
  const unknown: string[] = [];

  for (const name of preferred) {
    const trimmed = name.trim();

    if (!trimmed) {
      continue;
    }

    const matched = normalizedHeaders.get(normalize(trimmed));

    if (!matched) {
      unknown.push(trimmed);
      continue;
    }

    if (!resolved.includes(matched)) {
      resolved.push(matched);
    }
  }

  if (unknown.length > 0) {
    throw new ColumnMappingError(
      `표시할 컬럼을 시트에서 찾지 못했습니다: ${unknown.join(', ')}. 시트 헤더: ${
        headers.filter(Boolean).join(', ') || '(없음)'
      }`,
    );
  }

  return resolved;
}

/**
 * Verifies the stored respondent mapping still matches the sheet. Name and
 * phone must exist; gender and product are only checked when mapped. The
 * internal id column may be absent because the server creates it.
 */
export function assertRespondentMappingPresent(headers: string[], mapping: ColumnMapping) {
  const normalizedHeaders = new Set(headers.map(normalize));
  const missing: string[] = [];

  for (const key of requiredMappingKeys) {
    if (!normalizedHeaders.has(normalize(mapping[key]))) {
      missing.push(`${columnMappingLabels[key]}(${mapping[key]})`);
    }
  }

  for (const key of optionalMappingKeys) {
    const value = mapping[key];

    if (value && !normalizedHeaders.has(normalize(value))) {
      missing.push(`${columnMappingLabels[key]}(${value})`);
    }
  }

  if (missing.length > 0) {
    throw new ColumnMappingError(
      `저장된 컬럼 매핑과 시트 헤더가 다릅니다: ${missing.join(
        ', ',
      )}. Sheets 설정에서 연결을 다시 저장하세요.`,
    );
  }
}

/** Every stored display column must still exist in the sheet. */
export function assertDisplayColumnsPresent(
  headers: string[],
  displayColumns: readonly string[],
) {
  const normalizedHeaders = new Set(headers.map(normalize));
  const missing = displayColumns.filter((header) => !normalizedHeaders.has(normalize(header)));

  if (missing.length > 0) {
    throw new ColumnMappingError(
      `저장된 표시 컬럼이 시트에 없습니다: ${missing.join(
        ', ',
      )}. Sheets 설정에서 연결을 다시 저장하세요.`,
    );
  }
}
