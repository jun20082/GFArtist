import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SourceSettingsForm } from '@/app/settings/source-settings-form';
import { SyncResponsesButton } from '@/app/settings/sync-responses-button';
import { RetryStatusSyncButton } from '@/app/settings/retry-status-sync-button';
import { CleanupDuplicatesButton } from '@/app/settings/cleanup-duplicates-button';
import { getWorkspaceContext, getWorkspaceMemberships, workspaceRoleLabels } from '@/lib/workspace';
import { WorkspaceSwitcher } from '@/app/workspace-switcher';
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

  const context = await getWorkspaceContext(session.user.id);
  const memberships = await getWorkspaceMemberships(session.user.id);
  const sourceSettings = context?.sourceSettings ?? null;
  const roleLabel = context ? workspaceRoleLabels[context.role] : null;
  const canEditSettings = !context || context.role === 'OWNER';
  const canSync = context?.role === 'OWNER' && Boolean(sourceSettings);
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
          <div className="flex flex-col items-end gap-2">
            <Link className="text-sm text-emerald-300 hover:text-emerald-200" href="/">
              응답자 검색
            </Link>
            <WorkspaceSwitcher memberships={memberships} />
          </div>
        </div>
        {context ? (
          <dl className="mt-6 space-y-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div>
              워크스페이스: {context.workspace.name} · 내 역할: {roleLabel}
            </div>
            {sourceSettings ? (
              <>
                <div>파티명: {sourceSettings.partyName}</div>
                <div>원본 탭: {sourceSettings.responseSheetName}</div>
                <div>운영 상태 탭: {sourceSettings.operatingStatusSheetName}</div>
                <div>
                  마지막 동기화:{' '}
                  {sourceSettings.lastResponseSyncAt
                    ? formatKoreaTime(sourceSettings.lastResponseSyncAt)
                    : '없음'}
                </div>
              </>
            ) : (
              <div className="text-amber-300">
                아직 시트가 연결되지 않았습니다. 아래에서 연결하세요.
              </div>
            )}
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
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-medium text-white">새 워크스페이스를 만듭니다</p>
            <p className="mt-2 leading-6">
              아래에서 자기 파티의 Google Sheets를 연결하면 이 계정의 워크스페이스가 만들어집니다.
            </p>
          </div>
        )}
        <div className="mt-8">
          {canEditSettings ? (
            <SourceSettingsForm
              partyName={sourceSettings?.partyName ?? null}
              responseSheetName={sourceSettings?.responseSheetName ?? null}
              spreadsheetId={sourceSettings?.spreadsheetId ?? null}
              operatingStatusSheetName={sourceSettings?.operatingStatusSheetName ?? null}
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
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="font-medium text-white">Sheets 설정은 소유자만 변경할 수 있습니다</p>
              <p className="mt-2 leading-6">
                현재 역할은 {roleLabel}입니다. 연결 정보를 바꾸려면 워크스페이스 소유자에게
                요청하세요. 응답 동기화와 상태 변경은 계속 사용할 수 있습니다.
              </p>
            </div>
          )}
        </div>
        <div className="mt-6">
          {canSync ? (
            <SyncResponsesButton />
          ) : sourceSettings ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="font-medium text-white">응답 동기화는 소유자만 실행할 수 있습니다</p>
              <p className="mt-2 leading-6">
                동기화는 원본 응답 탭에 내부 ID를 기록하므로 워크스페이스 소유자만 실행할 수
                있습니다. 필요하면 소유자에게 요청하세요.
              </p>
            </div>
          ) : null}
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
