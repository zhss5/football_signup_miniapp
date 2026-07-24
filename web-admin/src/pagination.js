(function initPagination(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.WebAdminPagination = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function paginationFactory() {
  function buildPaginationModel(input = {}) {
    const total = Math.max(0, Number(input.total) || 0);
    const limit = Math.max(1, Number(input.limit) || 20);
    const skip = Math.max(0, Number(input.skip) || 0);
    const pageCount = total === 0 ? 0 : Math.ceil(total / limit);
    const page = total === 0 ? 0 : Math.floor(skip / limit) + 1;

    return {
      total,
      page,
      pageCount,
      canPrevious: !input.loading && skip > 0,
      canNext: !input.loading && Boolean(input.hasMore),
      previousSkip: Math.max(0, skip - limit),
      nextSkip: skip + limit
    };
  }

  return {
    buildPaginationModel
  };
});
