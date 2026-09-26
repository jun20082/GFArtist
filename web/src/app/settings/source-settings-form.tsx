'use client';

import { FormEvent, useEffect, useState } from 'react';
import { unmappedColumnValue, type ColumnMapping } from '@/lib/column-mapping';

type SourceSettingsFormProps = {
  partyName: string | null;
  spreadsheetId: string | null;
  responseSheetName: string | null;
  operatingStatusSheetName: string | null;
  columnMapping: ColumnMapping | null;
  displayColumns: string[] | null;
};

type SourceSettingsResponse = {
  error?: string;
  sourceSettings?: {
    partyName: string;
    spreadsheetId: string;
    responseSheetName: string;
    operatingStatusSheetName: string;
    nameHeader: string;
    phoneHeader: string;
    genderHeader: string;
    orderedProductHeader: string;
    displayColumns: string[];
  } | null;
};

type HeadersResponse = {
  error?: string;
  tabs?: string[];
  headers?: string[];
};

const inputClassName =
  'mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300';

const selectClassName =
  'mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300';

const autoOption = { value: '', label: '자동 인식' };
const noneOption = { value: unmappedColumnValue, label: '사용 안 함' };

function pickResponseTab(tabs: string[], current: string) {
  if (tabs.includes(current)) {
    return current;
  }

  return tabs.find((tab) => /응답|responses?/i.test(tab)) ?? tabs[0] ?? '';
}

function pickOperatingTab(tabs: string[], current: string, responseTab: string) {
  if (tabs.includes(current)) {
    return current;
  }

  return tabs.find((tab) => /운영\s*상태/.test(tab)) ?? tabs.find((tab) => tab !== responseTab) ?? '';
}

export function SourceSettingsForm({
  partyName,
  spreadsheetId,
  responseSheetName,
  operatingStatusSheetName,
  columnMapping,
  displayColumns,
}: SourceSettingsFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [partyNameValue, setPartyNameValue] = useState(partyName ?? '');
  const [spreadsheetValue, setSpreadsheetValue] = useState(spreadsheetId ?? '');
  const [tabs, setTabs] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [responseSheetValue, setResponseSheetValue] = useState(responseSheetName ?? '');
  const [operatingStatusSheetValue, setOperatingStatusSheetValue] = useState(
    operatingStatusSheetName ?? '',
  );
  const [nameHeaderValue, setNameHeaderValue] = useState(columnMapping?.nameHeader ?? '');
  const [phoneHeaderValue, setPhoneHeaderValue] = useState(columnMapping?.phoneHeader ?? '');
  const [genderHeaderValue, setGenderHeaderValue] = useState(
    columnMapping ? columnMapping.genderHeader || unmappedColumnValue : '',
  );
  const [orderedProductHeaderValue, setOrderedProductHeaderValue] = useState(
    columnMapping ? columnMapping.orderedProductHeader || unmappedColumnValue : '',
  );
  const [displaySelection, setDisplaySelection] = useState<string[]>(displayColumns ?? []);

  async function fetchTabs(urlOrId: string) {
    const response = await fetch(
      `/api/source-settings/headers?spreadsheetUrlOrId=${encodeURIComponent(urlOrId)}`,
    );
    const result = (await response.json()) as HeadersResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '시트 탭을 불러오지 못했습니다.');
    }

    return result.tabs ?? [];
  }

  async function fetchHeaders(urlOrId: string, tab: string) {
    const response = await fetch(
      `/api/source-settings/headers?spreadsheetUrlOrId=${encodeURIComponent(
        urlOrId,
      )}&tab=${encodeURIComponent(tab)}`,
    );
    const result = (await response.json()) as HeadersResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '컬럼을 불러오지 못했습니다.');
    }

    return result.headers ?? [];
  }

  async function loadSheet(
    urlOrId: string,
    preferredResponse: string,
    preferredOperating: string,
  ) {
    setError(null);
    setMessage(null);
    setIsLoadingSheet(true);

    try {
      const tabList = await fetchTabs(urlOrId);
      setTabs(tabList);

      const responseTab = pickResponseTab(tabList, preferredResponse);
      const operatingTab = pickOperatingTab(tabList, preferredOperating, responseTab);
      setResponseSheetValue(responseTab);
      setOperatingStatusSheetValue(operatingTab);

      if (!responseTab) {
        setHeaders([]);
        return;
      }

      const headerList = await fetchHeaders(urlOrId, responseTab);
      setHeaders(headerList);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '시트를 불러오지 못했습니다.');
    } finally {
      setIsLoadingSheet(false);
    }
  }

  useEffect(() => {
    if (!spreadsheetId) {
      return;
    }

    // Defer so the first state updates happen outside the effect body.
    const timer = setTimeout(() => {
      void loadSheet(spreadsheetId, responseSheetName ?? '', operatingStatusSheetName ?? '');
    }, 0);

    return () => clearTimeout(timer);
    // Only auto-load for the initial stored connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResponseTabChange(tab: string) {
    setResponseSheetValue(tab);
    setError(null);

    if (!spreadsheetValue.trim() || !tab) {
      setHeaders([]);
      return;
    }

    setIsLoadingSheet(true);

    try {
      const headerList = await fetchHeaders(spreadsheetValue, tab);
      setHeaders(headerList);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '컬럼을 불러오지 못했습니다.');
    } finally {
      setIsLoadingSheet(false);
    }
  }

  function forgetIfMapped(header: string) {
    setDisplaySelection((current) => current.filter((value) => value !== header));
  }

  function toggleDisplayColumn(header: string) {
    setDisplaySelection((current) =>
      current.includes(header)
        ? current.filter((value) => value !== header)
        : [...current, header],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!responseSheetValue || !operatingStatusSheetValue) {
      setError('응답 탭과 운영 상태 탭을 선택하세요. "시트 불러오기"를 먼저 실행하세요.');
      return;
    }

    setIsSubmitting(true);

    const body: Record<string, unknown> = {
      partyName: partyNameValue,
      spreadsheetUrlOrId: spreadsheetValue,
      responseSheetName: responseSheetValue,
      operatingStatusSheetName: operatingStatusSheetValue,
      displayColumns: displaySelection,
    };

    if (nameHeaderValue) body.nameHeader = nameHeaderValue;
    if (phoneHeaderValue) body.phoneHeader = phoneHeaderValue;
    if (genderHeaderValue) body.genderHeader = genderHeaderValue;
    if (orderedProductHeaderValue) body.orderedProductHeader = orderedProductHeaderValue;

    const response = await fetch('/api/source-settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as SourceSettingsResponse;
    setIsSubmitting(false);

    if (!response.ok) {
      setError(result.error ?? '연결에 실패했습니다.');
      return;
    }

    if (result.sourceSettings) {
      setPartyNameValue(result.sourceSettings.partyName);
      setSpreadsheetValue(result.sourceSettings.spreadsheetId);
      setResponseSheetValue(result.sourceSettings.responseSheetName);
      setOperatingStatusSheetValue(result.sourceSettings.operatingStatusSheetName);
      setNameHeaderValue(result.sourceSettings.nameHeader);
      setPhoneHeaderValue(result.sourceSettings.phoneHeader);
      setGenderHeaderValue(result.sourceSettings.genderHeader || unmappedColumnValue);
      setOrderedProductHeaderValue(
        result.sourceSettings.orderedProductHeader || unmappedColumnValue,
      );
      setDisplaySelection(result.sourceSettings.displayColumns ?? []);
    }

    setMessage('Google Sheets 연결이 저장되었습니다. 아래 컬럼 매핑이 실제 적용값입니다.');
    void loadSheet(spreadsheetValue, responseSheetValue, operatingStatusSheetValue);
  }

  const displayOptions = headers.filter(
    (header) =>
      header !== nameHeaderValue &&
      header !== phoneHeaderValue &&
      header !== genderHeaderValue &&
      header !== orderedProductHeaderValue &&
      header !== '_internal_response_id',
  );

  return (
    <form
      className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6"
      onSubmit={handleSubmit}
    >
      <label className="block text-sm text-slate-200">
        파티명
        <input
          className={inputClassName}
          name="partyName"
          onChange={(event) => setPartyNameValue(event.target.value)}
          placeholder="조커이즈 할로윈 파티"
          required
          value={partyNameValue}
        />
      </label>

      <label className="block text-sm text-slate-200">
        Google Sheets URL 또는 ID
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="w-full min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300"
            name="spreadsheetUrlOrId"
            onChange={(event) => setSpreadsheetValue(event.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            required
            value={spreadsheetValue}
          />
          <button
            className="shrink-0 rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200 transition hover:border-white/40 disabled:opacity-50"
            disabled={isLoadingSheet || !spreadsheetValue.trim()}
            onClick={() =>
              loadSheet(spreadsheetValue, responseSheetValue, operatingStatusSheetValue)
            }
            type="button"
          >
            {isLoadingSheet ? '불러오는 중...' : '시트 불러오기'}
          </button>
        </div>
      </label>

      <label className="block text-sm text-slate-200">
        원본 응답 탭
        <select
          className={selectClassName}
          name="responseSheetName"
          onChange={(event) => handleResponseTabChange(event.target.value)}
          required
          value={responseSheetValue}
        >
          <option value="">탭을 선택하세요</option>
          {tabs.map((tab) => (
            <option key={tab} value={tab}>
              {tab}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-slate-200">
        운영 상태 탭
        <select
          className={selectClassName}
          name="operatingStatusSheetName"
          onChange={(event) => setOperatingStatusSheetValue(event.target.value)}
          required
          value={operatingStatusSheetValue}
        >
          <option value="">탭을 선택하세요</option>
          {tabs.map((tab) => (
            <option key={tab} value={tab}>
              {tab}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <p className="text-xs leading-5 text-slate-400">
          필수 컬럼은 이름과 전화번호입니다. 나머지는 시트에 없으면 자동으로 비워 둡니다.
        </p>

        <label className="block text-sm text-slate-200">
          이름 (필수)
          <select
            className={selectClassName}
            onChange={(event) => {
              setNameHeaderValue(event.target.value);
              forgetIfMapped(event.target.value);
            }}
            value={nameHeaderValue}
          >
            <option value={autoOption.value}>{autoOption.label}</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-slate-200">
          전화번호 (필수)
          <select
            className={selectClassName}
            onChange={(event) => {
              setPhoneHeaderValue(event.target.value);
              forgetIfMapped(event.target.value);
            }}
            value={phoneHeaderValue}
          >
            <option value={autoOption.value}>{autoOption.label}</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-slate-200">
          성별 (선택)
          <select
            className={selectClassName}
            onChange={(event) => {
              setGenderHeaderValue(event.target.value);
              forgetIfMapped(event.target.value);
            }}
            value={genderHeaderValue}
          >
            <option value={autoOption.value}>{autoOption.label}</option>
            <option value={noneOption.value}>{noneOption.label}</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-slate-200">
          주문 상품 (선택)
          <select
            className={selectClassName}
            onChange={(event) => {
              setOrderedProductHeaderValue(event.target.value);
              forgetIfMapped(event.target.value);
            }}
            value={orderedProductHeaderValue}
          >
            <option value={autoOption.value}>{autoOption.label}</option>
            <option value={noneOption.value}>{noneOption.label}</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <p className="text-xs leading-5 text-slate-400">
          추가로 저장·표시할 컬럼을 선택하세요. 응답 상세 화면에 함께 표시됩니다.
        </p>

        {displayOptions.length === 0 ? (
          <p className="text-xs text-slate-500">추가로 표시할 컬럼이 없습니다.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {displayOptions.map((header) => (
              <label className="flex items-center gap-2 text-sm text-slate-200" key={header}>
                <input
                  checked={displaySelection.includes(header)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900"
                  onChange={() => toggleDisplayColumn(header)}
                  type="checkbox"
                />
                {header}
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? '연결 확인 중...' : '연결 저장'}
      </button>

      {message ? (
        <p aria-live="polite" className="text-sm text-emerald-300" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
