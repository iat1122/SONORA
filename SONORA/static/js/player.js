

class SonoraPlayerController {
  constructor() {
    this.currentSong = null;
    this.isPlaying = false;
    this.currentPlaylist = [];
    this.currentIndex = -1;

    // UI Elements
    this.titleEl = document.getElementById('playerTitle');
    this.artistEl = document.getElementById('playerArtist');
    this.coverDisc = document.getElementById('playerCoverDisc');
    this.playBtn = document.getElementById('btnPlayerPlay');
    this.playIconSvg = document.getElementById('playIconSvg');
    this.prevBtn = document.getElementById('btnPlayerPrev');
    this.nextBtn = document.getElementById('btnPlayerNext');
    this.progressSlider = document.getElementById('playerProgress');
    this.currentTimeEl = document.getElementById('playerCurrentTime');
    this.totalTimeEl = document.getElementById('playerTotalTime');
    this.volumeSlider = document.getElementById('playerVolume');
    this.soundWave = document.getElementById('soundWave');

    this.initListeners();
  }

  initListeners() {
    // Play/Pause button
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
    }

    // Prev / Next buttons
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.playPrevious());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.playNext());
    }

    // Scrubber Seeking
    if (this.progressSlider) {
      this.progressSlider.addEventListener('input', (e) => {
        const percent = parseFloat(e.target.value);
        if (this.currentSong && this.currentSong.duration) {
          const seekSec = (percent / 100) * this.currentSong.duration;
          window.sonoraAudio.seek(seekSec);
          this.currentTimeEl.textContent = this.formatTime(seekSec);
        }
      });
    }

    // Volume Slider
    if (this.volumeSlider) {
      this.volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 100;
        window.sonoraAudio.setVolume(val);
      });
    }

    // Audio Engine Progress & End hooks
    window.sonoraAudio.onProgressCallback = (elapsed, duration) => {
      if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(elapsed);
      if (this.totalTimeEl) this.totalTimeEl.textContent = this.formatTime(duration);
      if (this.progressSlider && duration > 0) {
        this.progressSlider.value = (elapsed / duration) * 100;
      }
    };

    window.sonoraAudio.onEndCallback = () => {
      // Song completed: automatically dequeue next song from FIFO queue or DLL
      this.playNext();
    };
  }

  formatTime(seconds) {
    const s = Math.floor(seconds || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  setTrack(song) {
    this.currentSong = song;
    if (this.titleEl) this.titleEl.textContent = song.title;
    if (this.artistEl) this.artistEl.textContent = `${song.artist} • ${song.genre}`;
    if (this.totalTimeEl) this.totalTimeEl.textContent = this.formatTime(song.duration);
    if (this.progressSlider) this.progressSlider.value = 0;
  }

  async playSong(song) {
    if (!song) return;
    this.setTrack(song);

    // Record in backend SQL & update Doubly Linked List / History Stack
    try {
      fetch(`/api/songs/${song.id}/play`, { method: 'POST' });
    } catch (e) {
      console.warn('Could not record play count', e);
    }

    window.sonoraAudio.playSong(song);
    this.isPlaying = true;
    this.updateUIPlayingState(true);

    // Refresh UI queues, stacks & DLL pointers
    if (window.userDashboard) {
      window.userDashboard.refreshQueue();
      window.userDashboard.refreshHistory();
      window.userDashboard.highlightPlayingRow(song.id);
    }
  }

  togglePlay() {
    if (!this.currentSong) {
      // If no song loaded, grab first song in catalog
      if (this.currentPlaylist.length > 0) {
        this.playSong(this.currentPlaylist[0]);
      }
      return;
    }

    if (this.isPlaying) {
      window.sonoraAudio.pause();
      this.isPlaying = false;
      this.updateUIPlayingState(false);
    } else {
      window.sonoraAudio.resume();
      this.isPlaying = true;
      this.updateUIPlayingState(true);
    }
  }

  updateUIPlayingState(playing) {
    if (this.playIconSvg) {
      this.playIconSvg.innerHTML = playing
        ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>' // Pause icon
        : '<path d="M8 5v14l11-7z"/>';                    // Play icon
    }
    if (this.coverDisc) {
      this.coverDisc.classList.toggle('spinning', playing);
    }
    if (this.soundWave) {
      this.soundWave.classList.toggle('active', playing);
    }
  }

  async playNext() {
    // 1. Call backend next endpoint (Handles Queue FIFO priority, then Doubly Linked List next)
    try {
      const res = await fetch('/api/player/next');
      const data = await res.json();
      if (data.success && data.song) {
        this.playSong(data.song);
        if (window.userDashboard) {
          window.userDashboard.showToast(`Playing ${data.song.title} (${data.source})`, 'success');
        }
      }
    } catch (e) {
      console.error('Error advancing to next song', e);
    }
  }

  async playPrevious() {
    // Call backend prev endpoint (Doubly Linked List O(1) prev)
    try {
      const res = await fetch('/api/player/prev');
      const data = await res.json();
      if (data.success && data.song) {
        this.playSong(data.song);
        if (window.userDashboard) {
          window.userDashboard.showToast(`Playing ${data.song.title} (${data.source})`, 'success');
        }
      }
    } catch (e) {
      console.error('Error moving to previous song', e);
    }
  }
}

// Global player controller instance
window.sonoraPlayer = new SonoraPlayerController();

