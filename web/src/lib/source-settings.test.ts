import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { saveSourceSettings, type ValidatedSourceSettings } from './source-settings';
import { createResponse, prisma, resetDatabase, seedDefaultCategories } from './test-db';

function buildSettings(
  overrides: Partial<ValidatedSourceSettings> = {},
): ValidatedSourceSettings {
  return {
    partyName: '테스트 파티',
    spreadsheetUrlOrId: 'sheet-1',
    spreadsheetId: 'sheet-1',
    responseSheetName: '설문지 응답',
    operatingStatusSheetName: '운영 상태',
    ...overrides,
  };
}

before(async () => {
  await resetDatabase();
  await seedDefaultCategories();
});

after(async () => {
  await prisma.$disconnect();
});

describe('saveSourceSettings', () => {
  test('처음 저장하면 활성 행을 만든다', async () => {
    await resetDatabase();
    await seedDefaultCategories();

    const saved = await saveSourceSettings(buildSettings());
    assert.equal(saved.isActive, true);
    assert.equal(saved.spreadsheetId, 'sheet-1');
    assert.equal(await prisma.sourceSettings.count(), 1);
  });

  test('같은 spreadsheetId를 다시 저장해도 행이 늘지 않는다', async () => {
    await resetDatabase();
    await seedDefaultCategories();

    const first = await saveSourceSettings(buildSettings());
    const second = await saveSourceSettings(
      buildSettings({ partyName: '이름 변경', responseSheetName: '응답 2' }),
    );

    assert.equal(await prisma.sourceSettings.count(), 1);
    assert.equal(second.id, first.id);
    assert.equal(second.partyName, '이름 변경');
    assert.equal(second.responseSheetName, '응답 2');
    assert.equal(second.isActive, true);
  });

  test('다시 저장해도 연결된 응답이 활성 파티에 남는다', async () => {
    await resetDatabase();
    await seedDefaultCategories();

    const first = await saveSourceSettings(buildSettings());
    await createResponse(first.id, { name: '응답자', phoneRaw: '010-1111-2222' });

    const second = await saveSourceSettings(buildSettings({ partyName: '이름 변경' }));
    const active = await prisma.sourceSettings.findFirst({ where: { isActive: true } });

    assert.equal(second.id, first.id);
    assert.equal(active?.id, first.id);
    assert.equal(await prisma.response.count({ where: { sourceSettingsId: first.id } }), 1);
  });

  test('다른 spreadsheetId를 저장하면 이전 행은 비활성화된다', async () => {
    await resetDatabase();
    await seedDefaultCategories();

    const first = await saveSourceSettings(buildSettings());
    const second = await saveSourceSettings(
      buildSettings({ spreadsheetId: 'sheet-2', spreadsheetUrlOrId: 'sheet-2' }),
    );

    const rows = await prisma.sourceSettings.findMany({ orderBy: { createdAt: 'asc' } });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, first.id);
    assert.equal(rows[0].isActive, false);
    assert.equal(rows[1].id, second.id);
    assert.equal(rows[1].isActive, true);
  });

  test('활성 행은 항상 하나만 유지된다', async () => {
    await resetDatabase();
    await seedDefaultCategories();

    await saveSourceSettings(buildSettings());
    await saveSourceSettings(buildSettings({ spreadsheetId: 'sheet-2', spreadsheetUrlOrId: 'sheet-2' }));
    await saveSourceSettings(buildSettings());

    const activeCount = await prisma.sourceSettings.count({ where: { isActive: true } });
    assert.equal(activeCount, 1);

    const active = await prisma.sourceSettings.findFirst({ where: { isActive: true } });
    assert.equal(active?.spreadsheetId, 'sheet-1');
  });
});
