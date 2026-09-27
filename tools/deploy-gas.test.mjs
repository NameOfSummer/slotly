import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseConfig, parseDeploymentList, pickDeploymentId } from './deploy-gas.mjs';

const clasprc = { tokens: { default: { access_token: 'test' } } };

function config(target) {
  return {
    accounts: { main: clasprc, other: clasprc },
    targets: [
      Object.assign(
        {
          name: '自分用',
          account: 'main',
          scriptId: 'script-main',
          deploymentId: 'deploy-main',
        },
        target || {}
      ),
    ],
  };
}

describe('parseConfig', function () {
  it('同じアカウントの複数プロジェクトと、別アカウントを読む', function () {
    var parsed = parseConfig(
      JSON.stringify({
        accounts: { main: clasprc, other: clasprc },
        targets: [
          {
            name: '本番',
            account: 'main',
            scriptId: 'script-a',
            deploymentId: 'deploy-a',
          },
          {
            name: '検証',
            account: 'main',
            scriptId: 'script-b',
            deploymentId: 'deploy-b',
          },
          {
            account: 'other',
            scriptId: 'script-c',
            deploymentId: 'deploy-c',
          },
        ],
      })
    );
    assert.equal(parsed.targets.length, 3);
    assert.equal(parsed.targets[0].account, 'main');
    assert.equal(parsed.targets[1].scriptId, 'script-b');
    assert.equal(parsed.targets[2].name, 'other（script-c）');
    assert.deepEqual(parsed.targets[2].clasprc, clasprc);
  });

  it('空の Secret ではデプロイしない', function () {
    assert.throws(function () {
      parseConfig('  ');
    }, /デプロイはしていません/);
  });

  it('知らないアカウントは失敗する', function () {
    assert.throws(function () {
      parseConfig(JSON.stringify(config({ account: 'missing' })));
    }, /ログイン情報/);
  });

  it('deploymentId は省略できる', function () {
    var parsed = parseConfig(JSON.stringify(config({ deploymentId: undefined })));
    assert.equal(parsed.targets[0].deploymentId, '');
  });
});

describe('parseDeploymentList', function () {
  it('JSON の一覧を読む', function () {
    var output =
      'Fetching deployments...\n' +
      JSON.stringify([
        { deploymentId: 'head-one', versionNumber: undefined },
        { deploymentId: 'web-one', versionNumber: 4 },
      ]);
    assert.deepEqual(parseDeploymentList(output), [
      { deploymentId: 'head-one', versionNumber: null },
      { deploymentId: 'web-one', versionNumber: 4 },
    ]);
  });

  it('テキストの一覧を読む', function () {
    var output = ['Found 2 deployments.', '- head-one @HEAD', '- web-one @4 - 初回'].join('\n');
    assert.deepEqual(parseDeploymentList(output), [
      { deploymentId: 'head-one', versionNumber: null },
      { deploymentId: 'web-one', versionNumber: 4 },
    ]);
  });
});

describe('pickDeploymentId', function () {
  it('バージョン付きが1件ならその ID を返す', function () {
    assert.equal(
      pickDeploymentId([
        { deploymentId: 'head-one', versionNumber: null },
        { deploymentId: 'web-one', versionNumber: 3 },
      ]),
      'web-one'
    );
  });

  it('バージョン付きが無いときは初回デプロイを求める', function () {
    assert.throws(function () {
      pickDeploymentId([{ deploymentId: 'head-one', versionNumber: null }]);
    }, /初回デプロイ/);
  });

  it('バージョン付きが複数なら ID の指定を求める', function () {
    assert.throws(function () {
      pickDeploymentId([
        { deploymentId: 'web-one', versionNumber: 1 },
        { deploymentId: 'web-two', versionNumber: 2 },
      ]);
    }, /deploymentId を指定/);
  });
});
