package com.blackway.voca.video;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.TextView;
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

    public static final String RESULT_URI = "uri";
    public static final String RESULT_MIME_TYPE = "mimeType";
    public static final String RESULT_DURATION_MS = "durationMs";
    public static final String RESULT_SIZE_BYTES = "sizeBytes";

    private PreviewView previewView;
    private TextView statusView;
    private Button cancelButton;
    private Button recordButton;
    private Button switchButton;

    private ProcessCameraProvider cameraProvider;
    private VideoCapture<Recorder> videoCapture;
    private Recording activeRecording;
    private File outputFile;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable autoStopRunnable = this::stopRecording;
    private CameraSelector currentCameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA;
    private boolean usingFrontCamera = true;
    private long maxDurationMs = 90_000L;
    private long maxFileSizeBytes = 10L * 1024L * 1024L;
    private long recordingStartedAtMs = 0L;
    private boolean discardOnFinalize = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.native_video_recorder_activity);

        previewView = findViewById(R.id.native_video_preview);
        statusView = findViewById(R.id.native_video_status);
        cancelButton = findViewById(R.id.native_video_cancel);
        recordButton = findViewById(R.id.native_video_record);
        switchButton = findViewById(R.id.native_video_switch);

        previewView.setKeepScreenOn(true);
        maxDurationMs = getIntent().getLongExtra(EXTRA_MAX_DURATION_MS, maxDurationMs);
        maxFileSizeBytes = getIntent().getLongExtra(EXTRA_MAX_FILE_SIZE_BYTES, maxFileSizeBytes);

        String preferredCamera = getIntent().getStringExtra(EXTRA_PREFERRED_CAMERA);
        if ("back".equals(preferredCamera)) {
            usingFrontCamera = false;
            currentCameraSelector = CameraSelector.DEFAULT_BACK_CAMERA;
        }

        cancelButton.setOnClickListener((view) -> cancelRecordingFlow());
        recordButton.setOnClickListener((view) -> {
            if (activeRecording == null) {
                startRecording();
            } else {
                stopRecording();
            }
        });
        switchButton.setOnClickListener((view) -> {
            if (activeRecording != null) {
                return;
            }

            currentCameraSelector =
                usingFrontCamera
                    ? CameraSelector.DEFAULT_BACK_CAMERA
                    : CameraSelector.DEFAULT_FRONT_CAMERA;
            usingFrontCamera = !usingFrontCamera;
            bindCamera();
        });

        initializeCamera();
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacks(autoStopRunnable);

        if (cameraProvider != null) {
            cameraProvider.unbindAll();
        }

        super.onDestroy();
    }

    private void initializeCamera() {
        ListenableFuture<ProcessCameraProvider> providerFuture =
            ProcessCameraProvider.getInstance(this);

        providerFuture.addListener(() -> {
            try {
                cameraProvider = providerFuture.get();
                bindCamera();
            } catch (Exception exception) {
                finishWithError("The camera preview could not be started.");
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void bindCamera() {
        if (cameraProvider == null) {
            return;
        }

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
            cameraProvider.unbindAll();
            preview.setSurfaceProvider(previewView.getSurfaceProvider());
            cameraProvider.bindToLifecycle(this, currentCameraSelector, preview, videoCapture);
        } catch (Exception exception) {
            finishWithError("The selected camera could not be opened.");
        }
    }

    private void startRecording() {
        if (videoCapture == null) {
            finishWithError("The recorder is not ready.");
            return;
        }

        outputFile = new File(
            getCacheDir(),
            String.format(Locale.US, "vogi-video-%d.mp4", System.currentTimeMillis())
        );

        FileOutputOptions outputOptions =
            new FileOutputOptions.Builder(outputFile)
                .setFileSizeLimit(maxFileSizeBytes)
                .build();

        PendingRecording pendingRecording =
            videoCapture.getOutput().prepareRecording(this, outputOptions);
        pendingRecording = pendingRecording.withAudioEnabled();

        discardOnFinalize = false;
        recordingStartedAtMs = System.currentTimeMillis();
        activeRecording =
            pendingRecording.start(
                ContextCompat.getMainExecutor(this),
                this::handleVideoRecordEvent
            );

        recordButton.setText("Stop");
        switchButton.setEnabled(false);
        statusView.setText("Recording in progress...");
        mainHandler.postDelayed(autoStopRunnable, maxDurationMs);
    }

    private void stopRecording() {
        mainHandler.removeCallbacks(autoStopRunnable);
        if (activeRecording == null) {
            return;
        }

        activeRecording.stop();
        activeRecording = null;
    }

    private void cancelRecordingFlow() {
        if (activeRecording != null) {
            discardOnFinalize = true;
            stopRecording();
            return;
        }

        setResult(RESULT_CANCELED);
        finish();
    }

    private void handleVideoRecordEvent(@NonNull VideoRecordEvent event) {
        if (event instanceof VideoRecordEvent.Start) {
            return;
        }

        if (!(event instanceof VideoRecordEvent.Finalize)) {
            return;
        }

        VideoRecordEvent.Finalize finalizeEvent = (VideoRecordEvent.Finalize) event;
        mainHandler.removeCallbacks(autoStopRunnable);
        recordButton.setText("Start");
        switchButton.setEnabled(true);

        if (discardOnFinalize) {
            if (outputFile != null && outputFile.exists()) {
                outputFile.delete();
            }
            setResult(RESULT_CANCELED);
            finish();
            return;
        }

        boolean limitReached =
            finalizeEvent.getError() == VideoRecordEvent.Finalize.ERROR_FILE_SIZE_LIMIT_REACHED;
        if (finalizeEvent.hasError() && !limitReached) {
            if (outputFile != null && outputFile.exists()) {
                outputFile.delete();
            }
            finishWithError("The recording could not be completed.");
            return;
        }

        if (outputFile == null || !outputFile.exists() || outputFile.length() == 0L) {
            finishWithError("The recording did not produce a video file.");
            return;
        }

        long durationMs = Math.max(
            1_000L,
            finalizeEvent.getRecordingStats().getRecordedDurationNanos() / 1_000_000L
        );
        if (durationMs <= 0L) {
            durationMs = Math.max(1_000L, System.currentTimeMillis() - recordingStartedAtMs);
        }

        Intent result = new Intent();
        result.putExtra(RESULT_URI, Uri.fromFile(outputFile).toString());
        result.putExtra(RESULT_MIME_TYPE, "video/mp4");
        result.putExtra(RESULT_DURATION_MS, durationMs);
        result.putExtra(RESULT_SIZE_BYTES, outputFile.length());
        setResult(RESULT_OK, result);
        finish();
    }

    private void finishWithError(String message) {
        Intent result = new Intent();
        result.putExtra("error", message);
        setResult(RESULT_CANCELED, result);
        finish();
    }
}
