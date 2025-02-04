/*
 *  Copyright (c) 2017 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* a mock of the Chrome RTCLegacyStatReport */
function RTCLegacyStatsReport() {
  this.id = 'someid';
  this.type = 'set-me';
  this.timestamp = new Date();
  this._data = {};
}
RTCLegacyStatsReport.prototype.names = function() {
  return Object.keys(this._data);
};
RTCLegacyStatsReport.prototype.stat = function(name) {
  return this._data[name];
};

function makeLegacyStatsReport(type, data) {
  const report = new RTCLegacyStatsReport();
  report.type = type;
  report._data = data;
  return report;
}

describe('Chrome shim', () => {
  const shim = require('../../dist/chrome/chrome_shim');
  let window;

  beforeEach(() => {
    window = {
      navigator: {
        mediaDevices: {
          getUserMedia: jest.fn().mockReturnValue(Promise.resolve('stream')),
        },
      },
      RTCPeerConnection: function() {}
    };
  });

  describe('legacy getStats', () => {
    let pc;
    beforeEach(() => {
      window.RTCPeerConnection.prototype.getStats = function(cb) {
        setTimeout(cb, 0, {
          result: () => [
            makeLegacyStatsReport('localcandidate', {
              portNumber: '31337',
              ipAddress: '8.8.8.8',
              transport: 'udp',
              candidateType: 'host',
              priority: '12345'
            }),
          ]
        });
      };
      shim.shimGetStats(window);
      pc = new window.RTCPeerConnection();
    });

    it('returns a promise', () => {
      return pc.getStats();
    });

    it('returns chrome legacy getStats when called with a callback', (done) => {
      pc.getStats((result) => {
        expect(result).toHaveProperty('result');
        const report = result.result()[0];
        expect(report).toHaveProperty('id');
        expect(report).toHaveProperty('type');
        expect(report).toHaveProperty('timestamp');
        expect(report).toHaveProperty('stat');
        done();
      });
    });

    it('is translated into a Map', () => {
      return pc.getStats()
        .then(result => {
          expect(result).toBeInstanceOf(Map);
        });
    });
  });

  describe('PeerConnection shim', () => {
    it('fail silently if RTCPeerConnection is not present', () => {
      window = {};

      shim.shimPeerConnection(window);
    });
  });

  describe('AddTrackRemoveTrack shim', () => {
    it('fail silently if RTCPeerConnection is not present', () => {
      window = {};

      shim.shimAddTrackRemoveTrack(window);
    });
  });

  describe('getUserMedia shim', () => {
    it('fail silently if navigator.mediaDevices is not present', () => {
      window = {
        navigator: {}
      };

      shim.shimGetUserMedia(window);
    });
  });

  describe('getDisplayMedia shim', () => {
    const getSourceId = jest.fn().mockReturnValue(Promise.resolve('abc'));

    it('does not overwrite an existing ' +
        'navigator.mediaDevices.getDisplayMedia', () => {
      window.navigator.mediaDevices.getDisplayMedia = 'foo';
      shim.shimGetDisplayMedia(window, getSourceId);
      expect(window.navigator.mediaDevices.getDisplayMedia).toBe('foo');
    });

    it('does not if navigator.mediaDevices does not exist', () => {
      delete window.navigator.mediaDevices;
      shim.shimGetDisplayMedia(window);
      expect(window.navigator.mediaDevices).toBe(undefined);
    });

    it('shims navigator.mediaDevices.getDisplayMedia', () => {
      shim.shimGetDisplayMedia(window, getSourceId);
      expect(typeof window.navigator.mediaDevices.getDisplayMedia)
        .toBe('function');
    });

    it('calls getUserMedia with the sourceId', async() => {
      shim.shimGetDisplayMedia(window, getSourceId);
      await window.navigator.mediaDevices.getDisplayMedia({video: true});
      expect(window.navigator.mediaDevices.getUserMedia.mock.calls.length)
        .toBe(1);
      expect(window.navigator.mediaDevices.getUserMedia.mock.calls[0][0])
        .toEqual({
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: 'abc',
              maxFrameRate: 3,
            }
          }
        });
    });

    it('translates frameRate to legacy maxFrameRate', async() => {
      shim.shimGetDisplayMedia(window, getSourceId);
      await window.navigator.mediaDevices
        .getDisplayMedia({video: {frameRate: 25}});
      expect(window.navigator.mediaDevices.getUserMedia.mock.calls.length)
        .toBe(1);
      expect(window.navigator.mediaDevices.getUserMedia.mock.calls[0][0])
        .toEqual({
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: 'abc',
              maxFrameRate: 25,
            }
          }
        });
    });

    it('translates width to legacy maxWidth', async() => {
      shim.shimGetDisplayMedia(window, getSourceId);
      await window.navigator.mediaDevices
        .getDisplayMedia({video: {width: 640}});
      expect(window.navigator.mediaDevices.getUserMedia.mock.calls.length)
        .toBe(1);
      expect(window.navigator.mediaDevices.getUserMedia.mock.calls[0][0])
        .toEqual({
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: 'abc',
              maxFrameRate: 3,
              maxWidth: 640,
            }
          }
        });
    });

    it('translates height to legacy maxHeight', async() => {
      shim.shimGetDisplayMedia(window, getSourceId);
      await window.navigator.mediaDevices
        .getDisplayMedia({video: {height: 480}});
      expect(window.navigator.mediaDevices.getUserMedia.mock.calls.length)
        .toBe(1);
      expect(window.navigator.mediaDevices.getUserMedia.mock.calls[0][0])
        .toEqual({
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: 'abc',
              maxFrameRate: 3,
              maxHeight: 480,
            }
          }
        });
    });
  });
});
