import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateRowGroups, mergeRowValues } from './duplicate-rows';

describe('findDuplicateRowGroups', () => {
  test('같은 ID가 두 행에 있으면 그룹으로 묶는다', () => {
    const rows = [
      ['resp_a', '김세진'],
      ['resp_b', '이서연'],
      ['resp_a', '김세진'],
    ];

    assert.deepEqual(findDuplicateRowGroups(rows, 0), [
      { internalResponseId: 'resp_a', rowNumbers: [2, 4] },
    ]);
  });

  test('행 번호는 헤더를 포함한 시트 좌표를 돌려준다', () => {
    const rows = [['resp_a'], ['resp_b'], ['resp_a'], ['resp_a']];

    assert.deepEqual(findDuplicateRowGroups(rows, 0), [
      { internalResponseId: 'resp_a', rowNumbers: [2, 4, 5] },
    ]);
  });

  test('ID 앞뒤 공백을 무시한다', () => {
    const rows = [['resp_a'], ['  resp_a  ']];

    assert.deepEqual(findDuplicateRowGroups(rows, 0), [
      { internalResponseId: 'resp_a', rowNumbers: [2, 3] },
    ]);
  });

  test('중복이 없으면 빈 배열을 돌려준다', () => {
    const rows = [['resp_a'], ['resp_b']];

    assert.deepEqual(findDuplicateRowGroups(rows, 0), []);
  });

  test('빈 ID 행은 무시한다', () => {
    const rows = [[''], ['   '], ['']];

    assert.deepEqual(findDuplicateRowGroups(rows, 0), []);
  });

  test('여러 ID가 각각 중복이면 모두 돌려준다', () => {
    const rows = [['resp_a'], ['resp_b'], ['resp_a'], ['resp_b']];

    assert.deepEqual(findDuplicateRowGroups(rows, 0), [
      { internalResponseId: 'resp_a', rowNumbers: [2, 4] },
      { internalResponseId: 'resp_b', rowNumbers: [3, 5] },
    ]);
  });
});

describe('mergeRowValues', () => {
  test('첫 행 값을 우선 사용한다', () => {
    const merged = mergeRowValues([
      ['a', 'b'],
      ['a', 'b'],
    ]);

    assert.deepEqual(merged, ['a', 'b']);
  });

  test('중복 행에만 있는 값을 보존한다', () => {
    const merged = mergeRowValues([
      ['resp_a', '김세진', ''],
      ['resp_a', '김세진', '수동 메모'],
    ]);

    assert.deepEqual(merged, ['resp_a', '김세진', '수동 메모']);
  });

  test('공백만 있는 값은 비어 있는 것으로 본다', () => {
    const merged = mergeRowValues([
      ['resp_a', '   '],
      ['resp_a', '값'],
    ]);

    assert.deepEqual(merged, ['resp_a', '값']);
  });

  test('행 길이가 다르면 가장 긴 길이를 기준으로 채운다', () => {
    const merged = mergeRowValues([['a'], ['a', 'b', 'c']]);

    assert.deepEqual(merged, ['a', 'b', 'c']);
  });

  test('빈 입력이면 빈 배열을 돌려준다', () => {
    assert.deepEqual(mergeRowValues([]), []);
  });
});
