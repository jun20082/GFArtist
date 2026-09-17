import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { searchResponses } from './responses';
import {
  createResponse,
  createSourceSettings,
  prisma,
  resetDatabase,
  seedDefaultCategories,
} from './test-db';

let sourceSettingsId = '';

before(async () => {
  await resetDatabase();
  await seedDefaultCategories();

  const settings = await createSourceSettings();
  sourceSettingsId = settings.id;

  await createResponse(sourceSettingsId, {
    name: '허준범',
    phoneRaw: '010-5801-5539',
    entryStatus: 'ENTERED',
    productStatus: 'NOT_RECEIVED',
  });
  await createResponse(sourceSettingsId, {
    name: '허준범',
    phoneRaw: '010-1234-5678',
    entryStatus: 'NOT_ENTERED',
    productStatus: 'NOT_RECEIVED',
  });
  await createResponse(sourceSettingsId, {
    name: '이서연',
    phoneRaw: '010-8973-8495',
    entryStatus: 'ENTERED',
    productStatus: 'RECEIVED',
  });
  await createResponse(sourceSettingsId, {
    name: '박서연',
    phoneRaw: '010-2345-6789',
    entryStatus: 'NOT_ENTERED',
    productStatus: 'RECEIVED',
  });
  await createResponse(sourceSettingsId, {
    name: '최민준',
    phoneRaw: '010-9876-1122',
    entryStatus: 'ENTERED',
    productStatus: 'RECEIVED',
  });

  const otherSettings = await createSourceSettings({ partyName: '다른 파티' });
  await createResponse(otherSettings.id, { name: '허준범', phoneRaw: '010-0000-0000' });
});

after(async () => {
  await prisma.$disconnect();
});

describe('searchResponses 이름 검색', () => {
  test('이름 전체로 검색한다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '허준범' });
    assert.equal(results.length, 2);
  });

  test('성을 제외한 이름으로 검색한다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '준범' });
    assert.equal(results.length, 2);
  });

  test('이름 일부로 검색한다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '서연' });
    assert.deepEqual(results.map((row) => row.name).sort(), ['박서연', '이서연']);
  });

  test('일치하는 이름이 없으면 빈 배열을 돌려준다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '없는이름' });
    assert.equal(results.length, 0);
  });
});

describe('searchResponses 전화번호 검색', () => {
  test('전화번호 전체로 검색한다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '01058015539' });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, '허준범');
  });

  test('하이픈이 포함된 전화번호로 검색한다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '010-5801-5539' });
    assert.equal(results.length, 1);
  });

  test('전화번호 뒷자리로 검색한다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '5539' });
    assert.equal(results.length, 1);
    assert.equal(results[0].phoneRaw, '010-5801-5539');
  });

  test('공백이 포함된 전화번호로 검색한다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '010 5801 5539' });
    assert.equal(results.length, 1);
  });
});

describe('searchResponses 상태 필터', () => {
  test('입장 완료만 필터링한다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '', entryStatus: 'ENTERED' });
    assert.equal(results.length, 3);
    assert.ok(results.every((row) => row.entryStatus === 'ENTERED'));
  });

  test('미입장만 필터링한다', async () => {
    const results = await searchResponses(sourceSettingsId, {
      query: '',
      entryStatus: 'NOT_ENTERED',
    });
    assert.equal(results.length, 2);
  });

  test('상품 수령 완료만 필터링한다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '', productStatus: 'RECEIVED' });
    assert.equal(results.length, 3);
  });

  test('입장 완료 AND 상품 미수령을 함께 적용한다', async () => {
    const results = await searchResponses(sourceSettingsId, {
      query: '',
      entryStatus: 'ENTERED',
      productStatus: 'NOT_RECEIVED',
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, '허준범');
    assert.equal(results[0].phoneRaw, '010-5801-5539');
  });

  test('검색어와 상태 필터를 함께 적용한다', async () => {
    const results = await searchResponses(sourceSettingsId, {
      query: '서연',
      entryStatus: 'ENTERED',
      productStatus: 'RECEIVED',
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, '이서연');
  });

  test('검색어와 필터가 모두 비면 활성 파티 전체를 돌려준다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '' });
    assert.equal(results.length, 5);
  });
});

describe('searchResponses 파티 격리', () => {
  test('다른 파티의 응답은 포함하지 않는다', async () => {
    const results = await searchResponses(sourceSettingsId, { query: '0000' });
    assert.equal(results.length, 0);
  });
});
