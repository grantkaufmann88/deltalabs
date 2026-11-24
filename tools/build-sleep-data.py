"""Build sleep-data.js for the website from the deltalabs-sleep repo.

Usage: python tools/build-sleep-data.py <cnn-visualization/data.js> <accel-visualizer/web/data/lying_down.csv> <out sleep-data.js>

Inputs (github.com/24mjihad/deltalabs-sleep):
  * CNNVISUALIZATION branch, cnn-visualization/data.js: one hour of a held-out Sleep-EDF
    night (subject 01, night 2) with the trained stager's real activations and outputs.
  * accelerometer-visualizer branch, lying_down.csv: head-worn accelerometer, RealWorld (HAR) 2016.

Nothing is synthesised here. The page plays a handful of epochs from that hour, so only
those are kept: the two input channels at the model's 100 Hz, per-channel mean activations
of each CNN layer, the pooled feature, night context, LSTM hidden state and stage probabilities.
"""
import base64
import json
import sys

import numpy as np

src, acc_csv, out = sys.argv[1:4]
s = open(src, encoding="utf-8").read()
D = json.loads(s[s.index("{"):s.rindex("}") + 1])
M = D["meta"]
N, S = M["win"], M["shapes"]

# Runs of consecutive epochs (index within the exported hour). The page plays a run,
# then skips ahead to the next one.
RUNS = [[8, 9], [29, 30, 31, 32], [48, 49, 50], [80, 81], [112, 113, 114]]
PLAY = [i for r in RUNS for i in r]


def u8(k):
    return np.frombuffer(base64.b64decode(D[k]), np.uint8)


def i8(k):
    return np.frombuffer(base64.b64decode(D[k]), np.int8)


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


x = i8("x").reshape(N, 2, 3000)
feat = u8("feat").reshape(N, 64)
h = i8("h").reshape(N, 32)
h0 = i8("h0").reshape(1, 32)
hprev = np.concatenate([h0, h[:-1]])

# mean activation of every channel over the 30 s, scaled 0..1 within its layer (sqrt for contrast)
means = []
for k in ("stem", "ds1", "ds2", "ds3"):
    a = u8(k).reshape(N, S[k][0], S[k][1]).astype(np.float64).mean(axis=2)
    means.append(np.sqrt(a / max(a.max(), 1e-6)))
means = np.concatenate(means, axis=1)                      # (N, 16+32+48+64)

# accelerometer: 50 Hz g -> 12.5 Hz milli-g, one 30 s chunk per played epoch, in recording order
A = np.loadtxt(acc_csv, delimiter=",", skiprows=1)[:, 1:]
A = A[: len(A) // 4 * 4].reshape(-1, 4, 3).mean(axis=1)     # 12.5 Hz
PER, SKIP = 375, 375                                        # skip the first 30 s (getting into bed)
acc = np.stack([A[SKIP + j * PER: SKIP + (j + 1) * PER].T for j in range(len(PLAY))])   # (n, 3, 375)

pred = [int(np.argmax(p)) for p in D["p"]]
true = D["nightTrue"][M["start"]:M["start"] + N]
data = {
    "meta": {
        "night": "Sleep-EDF, subject 01, night 2", "start": M["start"], "nightLen": M["nightLen"],
        "params": M["params"], "hourAcc": round(M["windowAcc"], 3), "xScale": [round(v, 3) for v in M["xScale"]],
        "accHz": 12.5, "accStart": SKIP / 12.5,
    },
    "hourTrue": true, "hourPred": pred,
    "runs": RUNS,
    "p": [D["p"][i] for i in PLAY],
    "aux": [D["aux"][i] for i in PLAY],
    "x": b64(x[PLAY]),
    "means": b64(np.clip(means[PLAY] * 255, 0, 255).astype(np.uint8)),
    "feat": b64(feat[PLAY]),
    "h": b64(h[PLAY]), "hPrev": b64(hprev[PLAY]),
    "acc": b64(np.round(acc * 1000).astype("<i2")),
}
js = "window.DELTA_SLEEP=" + json.dumps(data, separators=(",", ":")) + ";\n"
open(out, "w", encoding="utf-8").write(js)
S5 = "W123R"
for r in RUNS:
    print(r, "scorer", "".join(S5[true[i]] for i in r), "model", "".join(S5[pred[i]] for i in r),
          [round(max(D["p"][i]) * 100) for i in r])
print("wrote", out, round(len(js) / 1024), "KB")
