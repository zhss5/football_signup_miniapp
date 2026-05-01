const fs = require('fs');
const path = require('path');

describe('insurance web-view page', () => {
  test('renders a web-view bound to the decoded insurance URL', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/pages/insurance-webview/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('<web-view src="{{url}}"');
  });

  test('decodes the URL query into page data', () => {
    let pageConfig;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });

    jest.resetModules();
    require('../../../miniprogram/pages/insurance-webview/index');

    const ctx = {
      data: {
        url: ''
      },
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };
    const insuranceUrl = 'https://insurance.example.com/apply?activity=abc&team=white';

    pageConfig.onLoad.call(ctx, {
      url: encodeURIComponent(insuranceUrl)
    });

    expect(ctx.data.url).toBe(insuranceUrl);
  });
});
