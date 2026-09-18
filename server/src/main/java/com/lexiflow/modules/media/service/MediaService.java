package com.lexiflow.modules.media.service;

import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;
import com.lexiflow.modules.media.entity.MediaItemEntity;
import com.lexiflow.modules.media.dto.ImportExternalMediaRequest;
import com.lexiflow.modules.media.model.SubtitleSource;
import com.lexiflow.modules.media.vo.MediaCueVo;
import com.lexiflow.modules.media.vo.MediaCueTranslationVo;
import com.lexiflow.modules.media.vo.MediaDetailVo;
import com.lexiflow.modules.media.vo.MediaPlaybackVo;
import com.lexiflow.modules.media.vo.SubtitleUploadVo;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface MediaService {

    List<MediaDetailVo> list(Long userId);

    MediaDetailVo detail(String publicId, Long userId);

    MediaDetailVo importExternal(ImportExternalMediaRequest request, Long userId);

    MediaPlaybackVo playback(String publicId, Long userId);

    List<MediaCueVo> cues(String publicId, Long userId);

    List<MediaCueTranslationVo> cueTranslations(String publicId, Long userId);

    List<AsyncJobVo> jobs(String publicId, Long userId);

    SubtitleUploadVo uploadSubtitle(String publicId, MultipartFile file, String language,
                                    SubtitleSource source, Long userId);

    AsyncJobVo reprocess(String publicId, Long userId);

    AsyncJobVo translate(String publicId, Long userId);

    MediaItemEntity requireOwned(String publicId, Long userId);

    void softDelete(String publicId, Long userId);
}
