import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  internalResponseIdHeader,
  planInternalIds,
  type InternalIdPlanInput,
} from './response-id';

function sequenceGenerator() {
  let counter = 0;

  return () => {
    counter += 1;
    return `resp_test_${counter}`;
  };
}

function plan(overrides: Partial<InternalIdPlanInput> = {}) {
  return planInternalIds({
    headers: ['이름', '전화번호', '_internal_response_id'],
    rows: [
      ['홍길동', '010-1111-2222', ''],
      ['김철수', '010-3333-4444', 'resp_existing'],
    ],
    nameIndex: 0,
    phoneIndex: 1,
    generateId: sequenceGenerator(),
    ...overrides,
  });
}

describe('planInternalIds', () => {
  test('빈 ID 만 생성하고 기존 ID 는 보존한다', () => {
    const result = plan();

    assert.equal(result.headerAdded, false);
    assert.equal(result.idIndex, 2);
    assert.deepEqual(result.columnValues, ['resp_test_1', 'resp_existing']);
    assert.equal(result.generatedCount, 1);
  });

  test('ID 헤더가 없으면 마지막 컬럼 뒤에 추가한다', () => {
    const result = plan({ headers: ['이름', '전화번호'] });

    assert.equal(result.headerAdded, true);
    assert.equal(result.idIndex, 2);
    assert.deepEqual(result.headerRow, ['이름', '전화번호', internalResponseIdHeader]);
    assert.deepEqual(result.columnValues, ['resp_test_1', 'resp_test_2']);
    assert.equal(result.generatedCount, 2);
  });

  test('이름과 전화번호가 모두 비어 있으면 건너뛴다', () => {
    const result = plan({
      rows: [
        ['', '', ''],
        ['이름만', '', ''],
        ['', '010-0000-0000', ''],
      ],
    });

    assert.deepEqual(result.columnValues, ['', 'resp_test_1', 'resp_test_2']);
    assert.equal(result.generatedCount, 2);
  });

  test('전화번호만 이름 칸에 있는 경우도 대상이다', () => {
    const result = plan({
      nameIndex: -1,
      rows: [['', '010-9999-8888', '']],
    });

    assert.deepEqual(result.columnValues, ['resp_test_1']);
  });

  test('ID 헤더의 공백과 대소문자를 무시하고 인식한다', () => {
    const result = plan({
      headers: ['이름', '전화번호', ' _Internal_Response_Id '],
      rows: [['홍길동', '010-1111-2222', 'resp_keep']],
    });

    assert.equal(result.headerAdded, false);
    assert.equal(result.idIndex, 2);
    assert.deepEqual(result.columnValues, ['resp_keep']);
  });

  test('생성할 행이 없으면 쓰기 대상도 없다', () => {
    const result = plan({
      rows: [
        ['홍길동', '010-1111-2222', 'resp_a'],
        ['김철수', '010-3333-4444', 'resp_b'],
      ],
    });

    assert.equal(result.generatedCount, 0);
    assert.deepEqual(result.columnValues, ['resp_a', 'resp_b']);
  });

  test('행이 없으면 빈 결과를 돌려준다', () => {
    const result = plan({ rows: [] });

    assert.deepEqual(result.columnValues, []);
    assert.equal(result.generatedCount, 0);
  });

  test('행 수만큼 값을 돌려준다', () => {
    const rows = [
      ['a', '010-1', ''],
      ['', '', ''],
      ['b', '', 'resp_x'],
    ];

    const result = plan({ rows });

    assert.equal(result.columnValues.length, rows.length);
  });
});
