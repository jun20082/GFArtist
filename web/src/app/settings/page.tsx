import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SourceSettingsForm } from '@/app/settings/source-settings-form';
import { SyncResponsesButton } from '@/app/settings/sync-responses-button';
import { RetryStatusSyncButton } from '@/app/settings/retry-status-sync-button';
import { CleanupDuplicatesButton } from '@/app/settings/cleanup-duplicates-button';
import { getWorkspaceSourceSettings } from '@/lib/source-settings';
import { StatusSyncState } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatKoreaTime(value: Date) {
  return value.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const sourceSettings = await getWorkspaceSourceSettings(session.user.id);
  const pendingCount = sourceSettings
    ? await prisma.response.count({
        where: {
          sourceSettingsId: sourceSettings.id,
          statusSyncState: { in: [StatusSyncState.PENDING, StatusSyncState.FAILED] },
        },
      })
    : 0;
  const lastSyncRun = sourceSettings
    ? await prisma.syncRun.findFirst({
        where: { sourceSettingsId: sourceSettings.id, kind: 'responses' },
        orderBy: { startedAt: 'desc' },
      })
    : null;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Google Sheets 연결</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              원본 응답 탭과 같은 Spreadsheet의 운영 상태 탭을 연결합니다.
            </p>
          </div>
          <Link className="text-sm text-emerald-300 hover:text-emerald-200" href="/">
            응답자 검색
          </Link>
        </div>
        {sourceSettings ? (
          <dl className="mt-6 space-y-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div>파티명: {sourceSettings.partyName}</div>
            <div>원본 탭: {sourceSettings.responseSheetName}</div>
            <div>운영 상태 탭: {sourceSettings.operatingStatusSheetName}</div>
            <div>
              마지막 동기화:{' '}
              {sourceSettings.lastResponseSyncAt
                ? formatKoreaTime(sourceSettings.lastResponseSyncAt)
                : '없음'}
            </div>
            <div>
              최근 동기화 결과:{' '}
              {lastSyncRun
                ? `${lastSyncRun.processedCount}건 · ${
                    lastSyncRun.success ? '성공' : lastSyncRun.finishedAt ? '실패' : '진행 중'
                  } · ${formatKoreaTime(lastSyncRun.finishedAt ?? lastSyncRun.startedAt)}`
                : '없음'}
            </div>
            {lastSyncRun?.errorMessage ? (
              <div className="text-rose-300">동기화 오류: {lastSyncRun.errorMessage}</div>
            ) : null}
          </dl>
        ) : null}
        <div className="mt-8">
          <SourceSettingsForm
            appsScriptUrl={sourceSettings?.appsScriptUrl ?? null}
            hasAppsScriptSecret={Boolean(sourceSettings?.appsScriptSecretEncrypted)}
            columnMapping={
              sourceSettings
                ? {
                    nameHeader: sourceSettings.nameHeader,
                    phoneHeader: sourceSettings.phoneHeader,
                    genderHeader: sourceSettings.genderHeader,
                    orderedProductHeader: sourceSettings.orderedProductHeader,
                    internalResponseIdHeader: sourceSettings.internalResponseIdHeader,
                  }
                : null
            }
          />
        </div>
        <div className="mt-6">
          <SyncResponsesButton />
        </div>
        <div className="mt-6">
          <RetryStatusSyncButton pendingCount={pendingCount} />
        </div>
        <div className="mt-6">
          <CleanupDuplicatesButton />
        </div>
      </div>
    </main>
  );
}
