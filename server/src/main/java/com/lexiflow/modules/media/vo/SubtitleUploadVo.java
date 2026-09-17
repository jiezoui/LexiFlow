package com.lexiflow.modules.media.vo;

public record SubtitleUploadVo(Long trackId, String language, String source, String format, int cueCount) {
}
