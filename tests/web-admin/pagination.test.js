const { buildPaginationModel } = require('../../web-admin/src/pagination');

test('buildPaginationModel calculates page controls from total and skip', () => {
  expect(buildPaginationModel({
    total: 86,
    limit: 20,
    skip: 20,
    hasMore: true
  })).toEqual({
    total: 86,
    page: 2,
    pageCount: 5,
    canPrevious: true,
    canNext: true,
    previousSkip: 0,
    nextSkip: 40
  });
});

test('buildPaginationModel disables both controls for zero rows', () => {
  expect(buildPaginationModel({
    total: 0,
    limit: 20,
    skip: 0,
    hasMore: false
  })).toEqual({
    total: 0,
    page: 0,
    pageCount: 0,
    canPrevious: false,
    canNext: false,
    previousSkip: 0,
    nextSkip: 20
  });
});

test('buildPaginationModel disables next on the last page', () => {
  expect(buildPaginationModel({
    total: 41,
    limit: 20,
    skip: 40,
    hasMore: false
  })).toMatchObject({
    total: 41,
    page: 3,
    pageCount: 3,
    canPrevious: true,
    canNext: false,
    previousSkip: 20,
    nextSkip: 60
  });
});

test('buildPaginationModel supports a first loaded page with a non-zero skip', () => {
  expect(buildPaginationModel({
    total: 86,
    limit: 20,
    skip: 40,
    hasMore: true
  })).toMatchObject({
    page: 3,
    pageCount: 5,
    canPrevious: true,
    canNext: true,
    previousSkip: 20,
    nextSkip: 60
  });
});

test('buildPaginationModel enables next for a populated first page', () => {
  expect(buildPaginationModel({
    total: 21,
    limit: 20,
    skip: 0,
    hasMore: true
  })).toMatchObject({
    page: 1,
    pageCount: 2,
    canPrevious: false,
    canNext: true,
    previousSkip: 0,
    nextSkip: 20
  });
});

test('buildPaginationModel disables controls while loading', () => {
  expect(buildPaginationModel({
    total: 86,
    limit: 20,
    skip: 20,
    hasMore: true,
    loading: true
  })).toMatchObject({
    canPrevious: false,
    canNext: false
  });
});
