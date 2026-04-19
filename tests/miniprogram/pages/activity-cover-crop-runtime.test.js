describe('activity cover crop page runtime', () => {
  function loadPage() {
    jest.resetModules();
    let pageConfig = null;

    global.Page = config => {
      pageConfig = config;
    };

    global.wx = {
      getSystemInfoSync: () => ({ windowWidth: 375 })
    };

    require('../../../miniprogram/pages/activity-cover-crop/index.js');
    return pageConfig;
  }

  test('onLoad can initialize from imagePath query without relying on an opener event channel', async () => {
    const page = loadPage();
    const initializeCropModel = jest.fn();
    const setData = jest.fn();

    await page.onLoad.call(
      {
        ...page,
        initializeCropModel,
        setData,
        getOpenerEventChannel: () => null
      },
      { imagePath: encodeURIComponent('wxfile://cover-1.png') }
    );

    expect(initializeCropModel).toHaveBeenCalledWith('wxfile://cover-1.png');
    expect(setData).not.toHaveBeenCalledWith(expect.objectContaining({ loadError: expect.any(String) }));
  });
});
