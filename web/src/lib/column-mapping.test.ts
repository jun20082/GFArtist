import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertMappingPresent,
  ColumnMappingError,
  defaultColumnMapping,
  resolveColumnMapping,
} from './column-mapping';

describe('resolveColumnMapping', () => {
  test('표준 헤더를 그대로 찾는다', () => {
    const headers = ['_internal_response_id', '이름', '전화번호', '성별', '주문 상품'];

    assert.deepEqual(resolveColumnMapping(headers), defaultColumnMapping);
  });

  test('컬럼 순서가 달라도 찾는다', () => {
    const headers = ['주문 상품', '성별', '전화번호', '이름', '_internal_response_id'];

    assert.deepEqual(resolveColumnMapping(headers), defaultColumnMapping);
  });

  test('추가 컬럼이 있어도 무시한다', () => {
    const headers = ['제출 시각', '이름', '전화번호', '성별', '주문 상품', '비고', '_internal_response_id'];

    assert.deepEqual(resolveColumnMapping(headers), defaultColumnMapping);
  });

  test('주문상품 같은 붙여쓴 헤더를 자동 매칭한다', () => {
    const headers = ['이름', '연락처', '성별', '주문상품', '_internal_response_id'];

    assert.deepEqual(resolveColumnMapping(headers), {
      nameHeader: '이름',
      phoneHeader: '연락처',
      genderHeader: '성별',
      orderedProductHeader: '주문상품',
      internalResponseIdHeader: '_internal_response_id',
    });
  });

  test('대소문자와 공백을 무시해 매칭하고 원본 헤더를 돌려준다', () => {
    const headers = [' Name ', 'PHONE', 'Gender', 'Product', '_internal_response_id'];

    assert.deepEqual(resolveColumnMapping(headers), {
      nameHeader: ' Name ',
      phoneHeader: 'PHONE',
      genderHeader: 'Gender',
      orderedProductHeader: 'Product',
      internalResponseIdHeader: '_internal_response_id',
    });
  });

  test('사용자가 지정한 헤더를 우선한다', () => {
    const headers = ['이름', '연락처', '성별', '상품', '_internal_response_id'];

    const mapping = resolveColumnMapping(headers, { orderedProductHeader: '상품' });

    assert.equal(mapping.orderedProductHeader, '상품');
  });

  test('찾지 못한 항목을 모두 알려준다', () => {
    const headers = ['이름', '비고'];

    assert.throws(
      () => resolveColumnMapping(headers),
      (error: unknown) =>
        error instanceof ColumnMappingError &&
        /전화번호, 성별, 주문 상품, 내부 ID/.test(error.message) &&
        /시트 헤더: 이름, 비고/.test(error.message),
    );
  });
});

describe('assertMappingPresent', () => {
  test('매핑이 그대로면 통과한다', () => {
    const headers = ['이름', '전화번호', '성별', '주문 상품', '_internal_response_id'];

    assert.doesNotThrow(() => assertMappingPresent(headers, defaultColumnMapping));
  });

  test('컬럼이 사라지면 안내 오류를 던진다', () => {
    const headers = ['이름', '전화번호', '성별', '_internal_response_id'];

    assert.throws(
      () => assertMappingPresent(headers, defaultColumnMapping),
      /주문 상품\(주문 상품\)/,
    );
  });
});
