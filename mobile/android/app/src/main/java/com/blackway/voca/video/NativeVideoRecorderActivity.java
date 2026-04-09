package com.blackway.voca.video;

import android.content.Intent;
import android.content.res.ColorStateList;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.VideoView;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.video.FallbackStrategy;
import androidx.camera.video.FileOutputOptions;
import androidx.camera.video.PendingRecording;
import androidx.camera.video.Quality;
import androidx.camera.video.QualitySelector;
import androidx.camera.video.Recorder;
import androidx.camera.video.Recording;
import androidx.camera.video.VideoCapture;
import androidx.camera.video.VideoRecordEvent;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import com.blackway.voca.R;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.File;
import java.util.Locale;

public class NativeVideoRecorderActivity extends AppCompatActivity {

    public static final String EXTRA_MAX_DURATION_MS = "maxDurationMs";
    public static final String EXTRA_MAX_FILE_SIZE_BYTES = "maxFileSizeBytes";
    public static final String EXTRA_PREFERRED_CAMERA = "preferredCamera";
    public static final String EXTRA_REPLY_MODE = "replyMode";
    public static final String EXTRA_REPLY_SENDER_LABEL = "replySenderLabel";
    public static final String EXTRA_REPLY_PREVIEW_TEXT = "replyPreviewText";

    public static final String RESULT_URI = "uri";
    public static final String RESULT_MIME_TYPE = "mimeType";
    public static final String RESULT_DURATION_MS = "durationMs";
    public static final String RESULT_SIZE_BYTES = "sizeBytes";

    private enum RecorderStage {
        PREPARING,
        LIVE,
        RECORDING,
        REVIEW,
    }

    private enum StopReason {
        NONE,
        MANUAL,
        TIME_LIMIT,
        SIZE_LIMIT,
        DISMISSED,
    }

    private PreviewView previewView;
    private VideoView reviewVideoView;
    private Button closeButton;
    private Button switchButton;
    private TextView statusChipView;
    private TextView secondaryChipView;
    private TextView limitChipView;
    private TextView sizeChipView;
    private TextView bannerView;
    private View replyCardView;
    private TextView replyModeView;
    private TextView replySenderView;
    private TextView replyPreviewView;
    private ProgressBar progressBar;
    private TextView footerTitleView;
    private TextView footerHintView;
    private TextView footerSummaryView;
    private Button actionLeftButton;
    private Button actionCenterButton;
    private Button actionRightButton;
    private TextView leftLabelView;
    private TextView rightLabelView;
    private FrameLayout recordButton;
    private View recordGlyphView;
    private View playOverlayView;
    private Button playOverlayButton;
    private View preparingOverlayView;
    private TextView preparingTitleView;
    private TextView preparingHintView;

    private ProcessCameraProvider cameraProvider;
    private VideoCapture<Recorder> videoCapture;
    private Recording activeRecording;
    private File outputFile;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable autoStopRunnable =
        () -> stopRecording(StopReason.TIME_LIMIT);
    private final Runnable reviewProgressRunnable = new Runnable() {
        @Override
        public void run() {
            if (stage != RecorderStage.REVIEW) {
                return;
            }

            updateUi();
            if (reviewVideoView.isPlaying()) {
                mainHandler.postDelayed(this, 200L);
            }
        }
    };
    private CameraSelector currentCameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA;
    private boolean usingFrontCamera = true;
    private boolean hasFrontCamera = true;
    private boolean hasBackCamera = true;
    private boolean acceptedResult = false;
    private RecorderStage stage = RecorderStage.PREPARING;
    private StopReason stopReason = StopReason.NONE;
    private long maxDurationMs = 90_000L;
    private long maxFileSizeBytes = 10L * 1024L * 1024L;
    private long safeMaxFileSizeBytes = Math.max(1L, Math.round(maxFileSizeBytes * 0.9d));
    private long recordingStartedAtMs = 0L;
    private long recordedDurationMs = 0L;
    private long recordedSizeBytes = 0L;
    private long reviewDurationMs = 0L;
    private boolean discardOnFinalize = false;
    private String bannerMessage = null;
    private String replyModeLabel = null;
    private String replySenderLabel = null;
    private String replyPreviewText = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.native_video_recorder_activity);

        bindViews();
        configureFromIntent();
        configureCallbacks();
        configureReplyCard();
        updateUi();
        initializeCamera();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (stage == RecorderStage.REVIEW && reviewVideoView.isPlaying()) {
            reviewVideoView.pause();
        }
        stopReviewProgressUpdates();
        updateUi();
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacks(autoStopRunnable);
        stopReviewProgressUpdates();

        if (cameraProvider != null) {
            cameraProvider.unbindAll();
        }

        if (activeRecording != null) {
            discardOnFinalize = true;
            activeRecording.stop();
            activeRecording = null;
        }

        reviewVideoView.stopPlayback();

        if (!acceptedResult && outputFile != null && outputFile.exists()) {
            outputFile.delete();
        }

        super.onDestroy();
    }

    private void bindViews() {
        previewView = findViewById(R.id.native_video_preview);
        reviewVideoView = findViewById(R.id.native_video_review);
        closeButton = findViewById(R.id.native_video_close);
        switchButton = findViewById(R.id.native_video_switch);
        statusChipView = findViewById(R.id.native_video_status_chip);
        secondaryChipView = findViewById(R.id.native_video_secondary_chip);
        limitChipView = findViewById(R.id.native_video_limit_chip);
        sizeChipView = findViewById(R.id.native_video_size_chip);
        bannerView = findViewById(R.id.native_video_banner);
        replyCardView = findViewById(R.id.native_video_reply_card);
        replyModeView = findViewById(R.id.native_video_reply_mode);
        replySenderView = findViewById(R.id.native_video_reply_sender);
        replyPreviewView = findViewById(R.id.native_video_reply_preview);
        progressBar = findViewById(R.id.native_video_progress);
        footerTitleView = findViewById(R.id.native_video_footer_title);
        footerHintView = findViewById(R.id.native_video_footer_hint);
        footerSummaryView = findViewById(R.id.native_video_footer_summary);
        actionLeftButton = findViewById(R.id.native_video_action_left);
        actionCenterButton = findViewById(R.id.native_video_action_center);
        actionRightButton = findViewById(R.id.native_video_action_right);
        leftLabelView = findViewById(R.id.native_video_left_label);
        rightLabelView = findViewById(R.id.native_video_right_label);
        recordButton = findViewById(R.id.native_video_record_button);
        recordGlyphView = findViewById(R.id.native_video_record_glyph);
        playOverlayView = findViewById(R.id.native_video_play_overlay);
        playOverlayButton = findViewById(R.id.native_video_play_button);
        preparingOverlayView = findViewById(R.id.native_video_preparing_overlay);
        preparingTitleView = findViewById(R.id.native_video_preparing_title);
        preparingHintView = findViewById(R.id.native_video_preparing_hint);

        previewView.setKeepScreenOn(true);
        previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        previewView.setBackgroundColor(ContextCompat.getColor(this, R.color.vogi_background));
        progressBar.setMax(1000);
    }

    private void configureFromIntent() {
        maxDurationMs = getIntent().getLongExtra(EXTRA_MAX_DURATION_MS, maxDurationMs);
        maxFileSizeBytes = getIntent().getLongExtra(EXTRA_MAX_FILE_SIZE_BYTES, maxFileSizeBytes);
        safeMaxFileSizeBytes = Math.max(1L, Math.round(maxFileSizeBytes * 0.9d));

        String preferredCamera = getIntent().getStringExtra(EXTRA_PREFERRED_CAMERA);
        if ("back".equals(preferredCamera)) {
            usingFrontCamera = false;
            currentCameraSelector = CameraSelector.DEFAULT_BACK_CAMERA;
        }

        replyModeLabel = getIntent().getStringExtra(EXTRA_REPLY_MODE);
        replySenderLabel = getIntent().getStringExtra(EXTRA_REPLY_SENDER_LABEL);
        replyPreviewText = getIntent().getStringExtra(EXTRA_REPLY_PREVIEW_TEXT);
    }

    private void configureCallbacks() {
        closeButton.setOnClickListener((view) -> closeFlow());
        switchButton.setOnClickListener((view) -> {
            if (stage != RecorderStage.LIVE || activeRecording != null || !canSwitchCamera()) {
                return;
            }

            usingFrontCamera = !usingFrontCamera;
            currentCameraSelector =
                usingFrontCamera
                    ? CameraSelector.DEFAULT_FRONT_CAMERA
                    : CameraSelector.DEFAULT_BACK_CAMERA;
            bindCamera();
        });
        actionLeftButton.setOnClickListener((view) -> {
            if (stage == RecorderStage.REVIEW) {
                toggleReviewPlayback();
                return;
            }

            closeFlow();
        });
        actionCenterButton.setOnClickListener((view) -> {
            if (stage == RecorderStage.REVIEW) {
                retakeRecording();
            }
        });
        actionRightButton.setOnClickListener((view) -> {
            if (stage == RecorderStage.REVIEW) {
                acceptRecording();
            }
        });
        recordButton.setOnClickListener((view) -> {
            if (stage == RecorderStage.LIVE) {
                startRecording();
                return;
            }

            if (stage == RecorderStage.RECORDING) {
                stopRecording(StopReason.MANUAL);
            }
        });
        playOverlayView.setOnClickListener((view) -> {
            if (stage == RecorderStage.REVIEW) {
                toggleReviewPlayback();
            }
        });
        playOverlayButton.setOnClickListener((view) -> {
            if (stage == RecorderStage.REVIEW) {
                toggleReviewPlayback();
            }
        });
        reviewVideoView.setOnPreparedListener((mediaPlayer) -> {
            mediaPlayer.setLooping(false);
            reviewDurationMs = Math.max(1_000L, reviewVideoView.getDuration());
            updateUi();
        });
        reviewVideoView.setOnCompletionListener((mediaPlayer) -> {
            stopReviewProgressUpdates();
            updateUi();
        });
        reviewVideoView.setOnErrorListener((mediaPlayer, what, extra) -> {
            bannerMessage = "The preview could not play. You can still retake or send the clip.";
            stopReviewProgressUpdates();
            updateUi();
            return true;
        });
        reviewVideoView.setOnClickListener((view) -> {
            if (stage == RecorderStage.REVIEW) {
                toggleReviewPlayback();
            }
        });
        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        closeFlow();
                    }
                }
            );
    }

    private void configureReplyCard() {
        if (replyPreviewText == null || replyPreviewText.trim().isEmpty()) {
            replyCardView.setVisibility(View.GONE);
            return;
        }

        replyModeView.setText(
            "thread".equalsIgnoreCase(replyModeLabel) ? "Thread Reply" : "Reply"
        );
        replySenderView.setText(
            replySenderLabel != null && !replySenderLabel.trim().isEmpty()
                ? replySenderLabel
                : "Conversation context"
        );
        replyPreviewView.setText(replyPreviewText);
        replyCardView.setVisibility(View.VISIBLE);
    }

    private void initializeCamera() {
        stage = RecorderStage.PREPARING;
        updateUi();

        ListenableFuture<ProcessCameraProvider> providerFuture =
            ProcessCameraProvider.getInstance(this);

        providerFuture.addListener(
            () -> {
                try {
                    cameraProvider = providerFuture.get();
                    bindCamera();
                } catch (Exception exception) {
                    finishWithError("The camera preview could not be started.");
                }
            },
            ContextCompat.getMainExecutor(this)
        );
    }

    private void bindCamera() {
        if (cameraProvider == null) {
            return;
        }

        stage = RecorderStage.PREPARING;
        bannerMessage = null;
        updateUi();

        try {
            hasFrontCamera = cameraProvider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA);
            hasBackCamera = cameraProvider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA);
        } catch (Exception exception) {
            finishWithError("The camera configuration could not be checked.");
            return;
        }

        if (!hasFrontCamera && !hasBackCamera) {
            finishWithError("No usable camera is available on this device.");
            return;
        }

        if (usingFrontCamera && !hasFrontCamera) {
            usingFrontCamera = false;
        } else if (!usingFrontCamera && !hasBackCamera) {
            usingFrontCamera = true;
        }
        currentCameraSelector =
            usingFrontCamera
                ? CameraSelector.DEFAULT_FRONT_CAMERA
                : CameraSelector.DEFAULT_BACK_CAMERA;

        Preview preview = new Preview.Builder().build();
        Recorder recorder =
            new Recorder.Builder()
                .setQualitySelector(
                    QualitySelector.from(
                        Quality.HD,
                        FallbackStrategy.lowerQualityOrHigherThan(Quality.SD)
                    )
                )
                .build();

        videoCapture = VideoCapture.withOutput(recorder);

        try {
            reviewVideoView.stopPlayback();
            stopReviewProgressUpdates();
            cameraProvider.unbindAll();

            previewView.post(
                () -> {
                    if (isFinishing() || isDestroyed() || cameraProvider == null) {
                        return;
                    }

                    try {
                        preview.setSurfaceProvider(previewView.getSurfaceProvider());
                        cameraProvider.bindToLifecycle(this, currentCameraSelector, preview, videoCapture);
                        stage = RecorderStage.LIVE;
                        updateUi();
                    } catch (Exception exception) {
                        finishWithError("The selected camera preview could not be attached.");
                    }
                }
            );
        } catch (Exception exception) {
            finishWithError("The selected camera could not be opened.");
        }
    }

    private boolean canSwitchCamera() {
        return hasFrontCamera && hasBackCamera;
    }

    private void startRecording() {
        if (videoCapture == null) {
            bannerMessage = "The recorder is not ready yet. Try again in a moment.";
            updateUi();
            return;
        }

        outputFile = new File(
            getCacheDir(),
            String.format(Locale.US, "vogi-video-%d.mp4", System.currentTimeMillis())
        );
        if (outputFile.exists()) {
            outputFile.delete();
        }

        FileOutputOptions outputOptions =
            new FileOutputOptions.Builder(outputFile)
                .setFileSizeLimit(maxFileSizeBytes)
                .build();

        PendingRecording pendingRecording =
            videoCapture.getOutput().prepareRecording(this, outputOptions);
        pendingRecording = pendingRecording.withAudioEnabled();

        discardOnFinalize = false;
        acceptedResult = false;
        stopReason = StopReason.NONE;
        bannerMessage = null;
        recordedDurationMs = 0L;
        recordedSizeBytes = 0L;
        reviewDurationMs = 0L;
        recordingStartedAtMs = System.currentTimeMillis();

        activeRecording =
            pendingRecording.start(
                ContextCompat.getMainExecutor(this),
                this::handleVideoRecordEvent
            );

        mainHandler.removeCallbacks(autoStopRunnable);
        mainHandler.postDelayed(autoStopRunnable, maxDurationMs);
        stage = RecorderStage.RECORDING;
        updateUi();
    }

    private void stopRecording(StopReason reason) {
        mainHandler.removeCallbacks(autoStopRunnable);
        stopReason = reason;

        if (activeRecording == null) {
            return;
        }

        activeRecording.stop();
        activeRecording = null;
    }

    private void toggleReviewPlayback() {
        if (stage != RecorderStage.REVIEW) {
            return;
        }

        if (reviewVideoView.isPlaying()) {
            reviewVideoView.pause();
            stopReviewProgressUpdates();
        } else {
            if (reviewDurationMs > 0L && reviewVideoView.getCurrentPosition() >= reviewDurationMs - 250L) {
                reviewVideoView.seekTo(0);
            }
            reviewVideoView.start();
            startReviewProgressUpdates();
        }

        updateUi();
    }

    private void retakeRecording() {
        cleanupOutputFile();
        reviewVideoView.stopPlayback();
        stopReviewProgressUpdates();
        recordedDurationMs = 0L;
        recordedSizeBytes = 0L;
        reviewDurationMs = 0L;
        bannerMessage = null;
        stopReason = StopReason.NONE;
        bindCamera();
    }

    private void acceptRecording() {
        if (outputFile == null || !outputFile.exists()) {
            bannerMessage = "The recorded clip is no longer available. Please retake it.";
            updateUi();
            return;
        }

        acceptedResult = true;
        reviewVideoView.pause();
        stopReviewProgressUpdates();

        Intent result = new Intent();
        result.putExtra(RESULT_URI, Uri.fromFile(outputFile).toString());
        result.putExtra(RESULT_MIME_TYPE, "video/mp4");
        result.putExtra(RESULT_DURATION_MS, Math.max(1_000L, recordedDurationMs));
        result.putExtra(RESULT_SIZE_BYTES, Math.max(1L, recordedSizeBytes));
        setResult(RESULT_OK, result);
        finish();
    }

    private void closeFlow() {
        if (stage == RecorderStage.RECORDING && activeRecording != null) {
            discardOnFinalize = true;
            stopRecording(StopReason.DISMISSED);
            return;
        }

        cleanupOutputFile();
        setResult(RESULT_CANCELED);
        finish();
    }

    private void handleVideoRecordEvent(@NonNull VideoRecordEvent event) {
        if (event instanceof VideoRecordEvent.Start) {
            stage = RecorderStage.RECORDING;
            bannerMessage = null;
            updateUi();
            return;
        }

        if (event instanceof VideoRecordEvent.Status) {
            VideoRecordEvent.Status statusEvent = (VideoRecordEvent.Status) event;
            recordedDurationMs =
                Math.max(
                    1_000L,
                    statusEvent.getRecordingStats().getRecordedDurationNanos() / 1_000_000L
                );
            recordedSizeBytes = statusEvent.getRecordingStats().getNumBytesRecorded();

            if (recordedSizeBytes >= safeMaxFileSizeBytes && activeRecording != null) {
                stopRecording(StopReason.SIZE_LIMIT);
            }

            updateUi();
            return;
        }

        if (!(event instanceof VideoRecordEvent.Finalize)) {
            return;
        }

        VideoRecordEvent.Finalize finalizeEvent = (VideoRecordEvent.Finalize) event;
        mainHandler.removeCallbacks(autoStopRunnable);
        activeRecording = null;

        if (discardOnFinalize) {
            cleanupOutputFile();
            setResult(RESULT_CANCELED);
            finish();
            return;
        }

        boolean limitReached =
            finalizeEvent.getError() == VideoRecordEvent.Finalize.ERROR_FILE_SIZE_LIMIT_REACHED;
        if (finalizeEvent.hasError() && !limitReached) {
            cleanupOutputFile();
            finishWithError("The recording could not be completed.");
            return;
        }

        if (outputFile == null || !outputFile.exists() || outputFile.length() == 0L) {
            cleanupOutputFile();
            finishWithError("The recording did not produce a usable video file.");
            return;
        }

        recordedSizeBytes = outputFile.length();
        if (recordedSizeBytes > maxFileSizeBytes) {
            cleanupOutputFile();
            finishWithError("Recording exceeded the 10 MB upload limit.");
            return;
        }

        long finalizeDurationMs =
            Math.max(
                1_000L,
                finalizeEvent.getRecordingStats().getRecordedDurationNanos() / 1_000_000L
            );
        if (finalizeDurationMs <= 0L) {
            finalizeDurationMs = Math.max(1_000L, System.currentTimeMillis() - recordingStartedAtMs);
        }
        recordedDurationMs = Math.max(recordedDurationMs, finalizeDurationMs);

        reviewVideoView.setVideoURI(Uri.fromFile(outputFile));
        reviewVideoView.seekTo(1);
        stage = RecorderStage.REVIEW;

        if (stopReason == StopReason.SIZE_LIMIT || limitReached) {
            bannerMessage = "Recording stopped near the upload limit to keep the clip sendable.";
        } else if (stopReason == StopReason.TIME_LIMIT) {
            bannerMessage = "Recording reached the configured time limit.";
        } else {
            bannerMessage = null;
        }

        updateUi();
    }

    private void finishWithError(String message) {
        Intent result = new Intent();
        result.putExtra("error", message);
        setResult(RESULT_CANCELED, result);
        finish();
    }

    private void cleanupOutputFile() {
        if (outputFile != null && outputFile.exists()) {
            outputFile.delete();
        }
        outputFile = null;
    }

    private void startReviewProgressUpdates() {
        mainHandler.removeCallbacks(reviewProgressRunnable);
        mainHandler.post(reviewProgressRunnable);
    }

    private void stopReviewProgressUpdates() {
        mainHandler.removeCallbacks(reviewProgressRunnable);
    }

    private void updateUi() {
        boolean isPreparing = stage == RecorderStage.PREPARING;
        boolean isRecording = stage == RecorderStage.RECORDING;
        boolean isReview = stage == RecorderStage.REVIEW;
        boolean isPlayingReview = isReview && reviewVideoView.isPlaying();

        previewView.setVisibility(isReview ? View.GONE : View.VISIBLE);
        reviewVideoView.setVisibility(isReview ? View.VISIBLE : View.GONE);
        playOverlayView.setVisibility(isReview && !isPlayingReview ? View.VISIBLE : View.GONE);
        preparingOverlayView.setVisibility(isPreparing ? View.VISIBLE : View.GONE);
        preparingTitleView.setText("Preparing camera");
        preparingHintView.setText("Checking camera and microphone access...");

        closeButton.setText(isReview ? "Discard" : "Close");
        switchButton.setEnabled(stage == RecorderStage.LIVE && canSwitchCamera());
        switchButton.setAlpha(switchButton.isEnabled() ? 1f : 0.5f);

        statusChipView.setText(getStatusChipText());
        statusChipView.setBackgroundResource(
            isRecording ? R.drawable.native_recorder_chip_recording : R.drawable.native_recorder_chip
        );
        secondaryChipView.setText(getSecondaryChipText());
        limitChipView.setText(getLimitChipText());
        sizeChipView.setText(getSizeChipText());

        bannerView.setVisibility(
            bannerMessage != null && !bannerMessage.trim().isEmpty() ? View.VISIBLE : View.GONE
        );
        bannerView.setText(bannerMessage != null ? bannerMessage : "");

        footerTitleView.setText(getFooterTitle());
        footerHintView.setText(getFooterHint());
        footerSummaryView.setText(getFooterSummary());

        progressBar.setVisibility(isRecording || isReview ? View.VISIBLE : View.GONE);
        if (isRecording) {
            progressBar.setProgressTintList(
                ColorStateList.valueOf(ContextCompat.getColor(this, R.color.vogi_primary))
            );
            progressBar.setProgress(
                (int) Math.min(
                    1000L,
                    Math.round((recordedSizeBytes * 1000d) / Math.max(1L, safeMaxFileSizeBytes))
                )
            );
        } else if (isReview) {
            progressBar.setProgressTintList(
                ColorStateList.valueOf(ContextCompat.getColor(this, R.color.vogi_accent))
            );
            progressBar.setProgress(getReviewProgress());
        } else {
            progressBar.setProgress(0);
        }

        actionLeftButton.setVisibility(View.VISIBLE);
        actionCenterButton.setVisibility(isReview ? View.VISIBLE : View.GONE);
        actionRightButton.setVisibility(isReview ? View.VISIBLE : View.GONE);
        recordButton.setVisibility(isReview ? View.GONE : View.VISIBLE);
        leftLabelView.setVisibility(View.GONE);
        rightLabelView.setVisibility(isReview ? View.GONE : View.VISIBLE);

        if (isReview) {
            actionLeftButton.setText(isPlayingReview ? "Pause" : "Play");
            actionCenterButton.setText("Retake");
            actionRightButton.setText("Send video");
            actionRightButton.setEnabled(outputFile != null && outputFile.exists());
            actionRightButton.setAlpha(actionRightButton.isEnabled() ? 1f : 0.6f);
            rightLabelView.setVisibility(View.GONE);
        } else {
            actionLeftButton.setText("Cancel");
            actionRightButton.setEnabled(true);
            actionRightButton.setAlpha(1f);
            rightLabelView.setText(
                isRecording
                    ? String.format(Locale.US, "%s left", formatDuration(getRemainingDurationMs()))
                    : String.format(Locale.US, "%s max", formatDuration(maxDurationMs))
            );
            rightLabelView.setVisibility(View.VISIBLE);
        }

        recordButton.setEnabled(!isPreparing);
        recordButton.setAlpha(recordButton.isEnabled() ? 1f : 0.55f);
        recordGlyphView.setBackgroundResource(
            isRecording ? R.drawable.native_recorder_record_stop : R.drawable.native_recorder_record_dot
        );

        if (isRecording) {
            FrameLayout.LayoutParams layoutParams =
                (FrameLayout.LayoutParams) recordGlyphView.getLayoutParams();
            layoutParams.width = dpToPx(30);
            layoutParams.height = dpToPx(30);
            recordGlyphView.setLayoutParams(layoutParams);
        } else {
            FrameLayout.LayoutParams layoutParams =
                (FrameLayout.LayoutParams) recordGlyphView.getLayoutParams();
            layoutParams.width = FrameLayout.LayoutParams.MATCH_PARENT;
            layoutParams.height = FrameLayout.LayoutParams.MATCH_PARENT;
            recordGlyphView.setLayoutParams(layoutParams);
        }
    }

    private String getStatusChipText() {
        if (stage == RecorderStage.RECORDING) {
            return String.format(Locale.US, "REC %s", formatDuration(recordedDurationMs));
        }
        if (stage == RecorderStage.REVIEW) {
            return "Review";
        }
        if (stage == RecorderStage.PREPARING) {
            return "Preparing";
        }
        return "Camera";
    }

    private String getSecondaryChipText() {
        if (stage == RecorderStage.RECORDING) {
            return String.format(Locale.US, "%s left", formatDuration(getRemainingDurationMs()));
        }
        if (stage == RecorderStage.REVIEW) {
            return formatDuration(recordedDurationMs);
        }
        return usingFrontCamera ? "Front camera" : "Back camera";
    }

    private String getLimitChipText() {
        if (stage == RecorderStage.REVIEW) {
            return "video/mp4";
        }
        return String.format(Locale.US, "%s max", formatDuration(maxDurationMs));
    }

    private String getSizeChipText() {
        if (stage == RecorderStage.REVIEW) {
            return formatFileSize(recordedSizeBytes);
        }
        return String.format(
            Locale.US,
            "%s / %s",
            formatFileSize(recordedSizeBytes),
            formatFileSize(safeMaxFileSizeBytes)
        );
    }

    private String getFooterTitle() {
        if (stage == RecorderStage.RECORDING) {
            return "Recording now";
        }
        if (stage == RecorderStage.REVIEW) {
            return "Review video";
        }
        if (stage == RecorderStage.PREPARING) {
            return "Preparing camera";
        }
        return "Camera mode";
    }

    private String getFooterHint() {
        if (stage == RecorderStage.RECORDING) {
            return "Recording stops automatically before the safe upload limit is reached.";
        }
        if (stage == RecorderStage.REVIEW) {
            return "Play it back, retake it, or send the accepted clip.";
        }
        if (stage == RecorderStage.PREPARING) {
            return "Checking camera and microphone access...";
        }
        return "Frame your shot, then record a video sized to stay under the upload limit.";
    }

    private String getFooterSummary() {
        if (stage == RecorderStage.REVIEW) {
            return formatFileSize(recordedSizeBytes);
        }
        return String.format(
            Locale.US,
            "%s / %s",
            formatFileSize(recordedSizeBytes),
            formatFileSize(safeMaxFileSizeBytes)
        );
    }

    private int getReviewProgress() {
        if (reviewDurationMs <= 0L) {
            long fallbackDuration = Math.max(1_000L, recordedDurationMs);
            int currentPosition = Math.max(0, reviewVideoView.getCurrentPosition());
            return (int) Math.min(1000L, Math.round((currentPosition * 1000d) / fallbackDuration));
        }

        int currentPosition = Math.max(0, reviewVideoView.getCurrentPosition());
        return (int) Math.min(1000L, Math.round((currentPosition * 1000d) / reviewDurationMs));
    }

    private long getRemainingDurationMs() {
        return Math.max(0L, maxDurationMs - Math.max(0L, recordedDurationMs));
    }

    private String formatDuration(long durationMs) {
        long totalSeconds = Math.max(0L, Math.round(durationMs / 1000d));
        long minutes = totalSeconds / 60L;
        long seconds = totalSeconds % 60L;
        return String.format(Locale.US, "%d:%02d", minutes, seconds);
    }

    private String formatFileSize(long bytes) {
        if (bytes >= 1024L * 1024L) {
            double megabytes = bytes / 1024d / 1024d;
            return String.format(Locale.US, megabytes >= 10d ? "%.0f MB" : "%.1f MB", megabytes);
        }

        long kilobytes = Math.max(1L, Math.round(bytes / 1024d));
        return String.format(Locale.US, "%d KB", kilobytes);
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }
}
