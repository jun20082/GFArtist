import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { groupRowRuns, writeInternalIds, type InternalIdSheetsClient } from './response-id-writer';
import { planInternalIds } from './response-id';

const target = {
  spreadsheetId: 'sheet-1',
  responseSheetName: '설문지 응답',
};

type Call = { range: string; values: string[][] };

function fakeClient() {
  const calls: Call[] = [];

  const client: InternalIdSheetsClient = {
    spreadsheets: {
      values: {
        update: async (params) => {
          calls.push({ range: params.range, values: params.requestBody.values });
          return {};
        },
      },
    },
  };

  return { client, calls };
}

function buildPlan(rows: unknown[][], headers = ['이름', '전화번호', '_internal_response_id']) {
  let counter = 0;

  return planInternalIds({
    headers,
    rows,
    nameIndex: 0,
    phoneIndex: 1,
    generateId: () => {
      counter += 1;
      return `resp_gen_${counter}`;
    },
  });
}

describe('groupRowRuns', () => {
  test('연속된 행을 하나의 구간으로 묶는다', () => {
    assert.deepEqual(groupRowRuns([1, 2, 3, 7, 8, 10]), [
      { start: 1, end: 3 },
      { start: 7, end: 8 },
      { start: 10, end: 10 },
    ]);
  });

  test('정렬되지 않은 입력도 처리한다', () => {
    assert.deepEqual(groupRowRuns([5, 1, 2]), [
      { start: 1, end: 2 },
      { start: 5, end: 5 },
    ]);
  });

  test('빈 입력이면 빈 배열이다', () => {
    assert.deepEqual(groupRowRuns([]), []);
  });
});

describe('writeInternalIds', () => {
  test('생성 건수가 없으면 아무것도 쓰지 않는다', async () => {
    const { client, calls } = fakeClient();
    const plan = buildPlan([['홍길동', '010-1111', 'resp_keep']]);

    const result = await writeInternalIds('user-1', target, plan, client);

    assert.deepEqual(result, { headerWritten: false, updatedRanges: 0, generatedCount: 0 });
    assert.equal(calls.length, 0);
  });

  test('ID 헤더가 없으면 헤더를 먼저 쓴다', async () => {
    const { client, calls } = fakeClient();
    const plan = buildPlan([['홍길동', '010-1111', '']], ['이름', '전화번호']);

    const result = await writeInternalIds('user-1', target, plan, client);

    assert.equal(result.headerWritten, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].range, `'설문지 응답'!C1`);
    assert.deepEqual(calls[0].values, [['_internal_response_id']]);
    assert.equal(calls[1].range, `'설문지 응답'!C2:C2`);
    assert.deepEqual(calls[1].values, [['resp_gen_1']]);
  });

  test('생성된 행만 시트 좌표로 기록한다', async () => {
    const { client, calls } = fakeClient();
    const plan = buildPlan([
      ['홍길동', '010-1111', ''],
      ['김철수', '010-2222', 'resp_keep'],
      ['이영희', '010-3333', ''],
    ]);

    await writeInternalIds('user-1', target, plan, client);

    assert.equal(calls.length, 2);
    assert.equal(calls[0].range, `'설문지 응답'!C2:C2`);
    assert.deepEqual(calls[0].values, [['resp_gen_1']]);
    assert.equal(calls[1].range, `'설문지 응답'!C4:C4`);
    assert.deepEqual(calls[1].values, [['resp_gen_2']]);
  });

  test('연속된 생성 행은 한 번의 요청으로 묶는다', async () => {
    const { client, calls } = fakeClient();
    const plan = buildPlan([
      ['a', '010-1', ''],
      ['b', '010-2', ''],
      ['c', '010-3', ''],
    ]);

    const result = await writeInternalIds('user-1', target, plan, client);

    assert.equal(result.updatedRanges, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].range, `'설문지 응답'!C2:C4`);
    assert.deepEqual(calls[0].values, [['resp_gen_1'], ['resp_gen_2'], ['resp_gen_3']]);
  });

  test('빈 행은 값도 쓰지 않는다', async () => {
    const { client, calls } = fakeClient();
    const plan = buildPlan([
      ['', '', ''],
      ['a', '', ''],
    ]);

    await writeInternalIds('user-1', target, plan, client);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].range, `'설문지 응답'!C3:C3`);
    assert.deepEqual(calls[0].values, [['resp_gen_1']]);
  });

  test('탭 이름의 작은따옴표를 이스케이프한다', async () => {
    const { client, calls } = fakeClient();
    const plan = buildPlan([['a', '010-1', '']]);

    await writeInternalIds(
      'user-1',
      { spreadsheetId: 'sheet-1', responseSheetName: "홍길동's 응답" },
      plan,
      client,
    );

    assert.equal(calls[0].range, `'홍길동''s 응답'!C2:C2`);
  });
});
