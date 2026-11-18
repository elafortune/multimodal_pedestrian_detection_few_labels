"""Sensor degradation models shared by the fusion data builder (S7) and the robustness evaluation.

All functions take / return uint8 HxWxC numpy arrays (OpenCV BGR for colour, single channel for IR).
"""
import numpy as np


def fog(img: np.ndarray, strength: float = 0.6, seed: int = 0) -> np.ndarray:
    """Homogeneous fog / smoke: blend towards a bright airlight + mild noise (affects RGB much more than LWIR)."""
    rng = np.random.default_rng(seed)
    air = 200.0
    out = img.astype(np.float32) * (1 - strength) + air * strength
    out += rng.normal(0, 4, img.shape)
    return np.clip(out, 0, 255).astype(np.uint8)


def low_light(img: np.ndarray, gamma: float = 2.5, gain: float = 0.35, seed: int = 0) -> np.ndarray:
    """Darker scene + sensor noise (shot-noise-like), on top of LLVIP's already low-light RGB."""
    rng = np.random.default_rng(seed)
    x = (img.astype(np.float32) / 255.0) ** gamma * gain
    x = x + rng.normal(0, 0.02, img.shape)
    return np.clip(x * 255, 0, 255).astype(np.uint8)


def dead(img: np.ndarray) -> np.ndarray:
    """Sensor failure: all-zero frame."""
    return np.zeros_like(img)


SCENARIOS = {
    # name: (rgb transform, ir transform or "reconstruct")
    "nominal": (None, None),
    "rgb_fog": (fog, None),
    "rgb_lowlight": (low_light, None),
    "rgb_dead": (dead, None),
    "ir_dead": (None, dead),
    "ir_reconstructed": (None, "reconstruct"),
}
