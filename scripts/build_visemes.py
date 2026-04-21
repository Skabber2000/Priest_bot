"""Build the viseme frame set.

Pipeline for each source image:
  1. Crop the baked-in caption band at the bottom (9 labeled frames).
  2. Detect MediaPipe FaceMesh landmarks on the result.
  3. Compute a similarity transform (rotation + uniform scale + translation)
     that aligns the source face to the 'rest' reference face using stable
     anchor landmarks (inner/outer eye corners + nose bridge — points that
     don't move during speech).
  4. Warp the image by that transform so every frame shares the exact same
     head pose. Runtime crossfades between them now look like a talking
     mouth instead of a ghost-double.
  5. Re-detect landmarks on the aligned frame and dump them all to JSON so
     later mesh-warp work can read them without re-running the detector.

Usage:
    python scripts/build_visemes.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

import os
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")  # quiet TF noise
import mediapipe as mp  # noqa: E402
from mediapipe.tasks import python as mp_python  # noqa: E402
from mediapipe.tasks.python import vision as mp_vision  # noqa: E402

ROOT = Path(__file__).parent.parent
SRC_DIR = ROOT / "Talking_head"
DST_DIR = ROOT / "web" / "public" / "visemes"
MODEL_PATH = ROOT / "scripts" / "models" / "face_landmarker.task"

CAPTION_PX = 100  # caption band height on labeled frames

# (source filename, output name, has_caption)
FRAMES: list[tuple[str, str, bool]] = [
    ("mReHb.jpg", "rest", False),
    ("rudME.jpg", "ah",   True),   # /ɑː/  father
    ("6gR2u.jpg", "ae",   True),   # /æ/    cat
    ("6DoL2.jpg", "ee",   True),   # /iː/   see
    ("6pWLm.jpg", "ih",   True),   # /ɪ/    bit
    ("Y1h4Q.jpg", "ai",   True),   # /aɪ/   my
    ("fFGQ1.jpg", "oo",   True),   # /uː/   boot
    ("7prb0.jpg", "ow",   True),   # /aʊ/   now
    ("tn0c9.jpg", "mbp",  True),   # /p, b/
    ("qIiMy.jpg", "sz",   True),   # /s, z/
]

# Landmark indices that stay still during speech and smiles.
# Inner & outer eye corners + nose bridge (2 points) — 6 anchors total.
ANCHOR_INDICES = [33, 133, 362, 263, 6, 168]


def _build_detector() -> "mp_vision.FaceLandmarker":
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Missing face_landmarker.task at {MODEL_PATH}. "
            "Download from "
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
            "face_landmarker/float16/1/face_landmarker.task"
        )
    options = mp_vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(MODEL_PATH)),
        num_faces=1,
        running_mode=mp_vision.RunningMode.IMAGE,
    )
    return mp_vision.FaceLandmarker.create_from_options(options)


_DETECTOR: "mp_vision.FaceLandmarker | None" = None


# The priest's face sits consistently around here across all 21 renders; without
# cropping first, MediaPipe's detector misses many of the more expressive frames
# (it dislikes tiny faces on busy cathedral backgrounds).
FACE_CROP_CENTER = (400, 530)
FACE_CROP_SIZE = (300, 400)  # (w, h)


def detect_landmarks(img: np.ndarray) -> np.ndarray | None:
    """Return (478, 2) ndarray of pixel coordinates in the *full image*, or None."""
    global _DETECTOR
    if _DETECTOR is None:
        _DETECTOR = _build_detector()

    h, w = img.shape[:2]
    cw, ch = FACE_CROP_SIZE
    x1 = max(0, FACE_CROP_CENTER[0] - cw // 2)
    y1 = max(0, FACE_CROP_CENTER[1] - ch // 2)
    x2 = min(w, x1 + cw)
    y2 = min(h, y1 + ch)
    crop = img[y1:y2, x1:x2]

    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = _DETECTOR.detect(mp_image)
    if not result.face_landmarks:
        return None
    ch_h, ch_w = crop.shape[:2]
    lm = result.face_landmarks[0]
    # Translate landmark coordinates back to full-image space.
    return np.array(
        [[p.x * ch_w + x1, p.y * ch_h + y1] for p in lm],
        dtype=np.float32,
    )


def similarity_align(
    src_img: np.ndarray,
    src_pts: np.ndarray,
    ref_pts: np.ndarray,
    out_size: tuple[int, int],
) -> np.ndarray | None:
    """Map src face onto ref face pose via RANSAC similarity transform."""
    src_anchors = src_pts[ANCHOR_INDICES]
    ref_anchors = ref_pts[ANCHOR_INDICES]
    M, _inliers = cv2.estimateAffinePartial2D(
        src_anchors, ref_anchors, method=cv2.RANSAC, ransacReprojThreshold=3.0,
    )
    if M is None:
        return None
    return cv2.warpAffine(
        src_img, M, out_size,
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )


def load_and_prep(path: Path, has_caption: bool) -> np.ndarray:
    img = cv2.imread(str(path))
    if img is None:
        raise FileNotFoundError(path)
    if has_caption:
        img = img[:-CAPTION_PX]
    return img


def main() -> int:
    DST_DIR.mkdir(parents=True, exist_ok=True)

    # --- Reference: rest frame ---
    rest_src_name, rest_key, rest_has_caption = FRAMES[0]
    assert rest_key == "rest"
    rest_img_full = load_and_prep(SRC_DIR / rest_src_name, rest_has_caption)
    # We crop the rest image to match the labeled frames' dimensions
    # (832x1116) so every output is the same size.
    target_h = rest_img_full.shape[0] - CAPTION_PX
    target_w = rest_img_full.shape[1]
    rest_img = rest_img_full[:target_h, :target_w]
    rest_pts = detect_landmarks(rest_img)
    if rest_pts is None:
        print("! face not detected in rest image", file=sys.stderr)
        return 1

    cv2.imwrite(
        str(DST_DIR / "rest.jpg"), rest_img,
        [cv2.IMWRITE_JPEG_QUALITY, 88, cv2.IMWRITE_JPEG_PROGRESSIVE, 1],
    )
    landmarks: dict[str, list[list[float]]] = {"rest": rest_pts.tolist()}
    print(f"  rest             -> rest.jpg (reference, {target_w}x{target_h})")

    # --- Labeled viseme frames, aligned to rest ---
    for src_name, key, has_caption in FRAMES[1:]:
        img = load_and_prep(SRC_DIR / src_name, has_caption)

        # Normalize to the reference canvas size before alignment.
        if img.shape[:2] != (target_h, target_w):
            img = cv2.resize(
                img, (target_w, target_h), interpolation=cv2.INTER_AREA,
            )

        pts = detect_landmarks(img)
        if pts is None:
            print(f"  {src_name:12s} ! landmarks not found, copying raw", file=sys.stderr)
            cv2.imwrite(str(DST_DIR / f"{key}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 88])
            continue

        aligned = similarity_align(img, pts, rest_pts, (target_w, target_h))
        if aligned is None:
            print(f"  {src_name:12s} ! similarity fit failed, copying raw", file=sys.stderr)
            cv2.imwrite(str(DST_DIR / f"{key}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 88])
            continue

        aligned_pts = detect_landmarks(aligned)
        if aligned_pts is not None:
            landmarks[key] = aligned_pts.tolist()

        cv2.imwrite(
            str(DST_DIR / f"{key}.jpg"), aligned,
            [cv2.IMWRITE_JPEG_QUALITY, 88, cv2.IMWRITE_JPEG_PROGRESSIVE, 1],
        )

        # Compute a quick sanity metric: anchor-point alignment RMSE after warp.
        if aligned_pts is not None:
            diff = aligned_pts[ANCHOR_INDICES] - rest_pts[ANCHOR_INDICES]
            rmse = float(np.sqrt((diff ** 2).sum(axis=1).mean()))
            tag = "OK " if rmse < 2.0 else "~  "
        else:
            rmse = float("nan")
            tag = "?  "
        print(f"  {src_name:12s} -> {key}.jpg  [{tag}anchor RMSE {rmse:.2f} px]")

    # --- Dump landmarks JSON for future mesh-warp work ---
    with (DST_DIR / "landmarks.json").open("w") as f:
        json.dump(
            {
                "version": 1,
                "anchor_indices": ANCHOR_INDICES,
                "image_size": [target_w, target_h],
                "frames": landmarks,
            },
            f,
        )

    print(f"\n{len(FRAMES)} frames + landmarks.json written to {DST_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
