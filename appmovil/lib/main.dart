import 'dart:async';
import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';
import 'package:geolocator/geolocator.dart';

void main() {
  runApp(const VelocimetroApp());
}

class VelocimetroApp extends StatelessWidget {
  const VelocimetroApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Velocímetro',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF0B0E17),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF22D3EE),
          brightness: Brightness.dark,
        ),
      ),
      home: const SpeedometerScreen(),
    );
  }
}

enum SpeedoStatus { idle, requesting, measuring, denied, error }

class SpeedometerScreen extends StatefulWidget {
  const SpeedometerScreen({super.key});

  @override
  State<SpeedometerScreen> createState() => _SpeedometerScreenState();
}

class _SpeedometerScreenState extends State<SpeedometerScreen> {
  static const double maxKmh = 240;

  SpeedoStatus _status = SpeedoStatus.idle;
  double _speedKmh = 0;
  double _accuracy = 0;
  String? _errorMessage;
  StreamSubscription<Position>? _sub;

  Position? _lastPosition;
  DateTime? _lastFixTime;
  double _filteredSpeed = 0;

  bool get _measuring => _status == SpeedoStatus.measuring;

  Future<void> _toggle() async {
    if (_measuring) {
      await _stop();
    } else {
      await _start();
    }
  }

  Future<void> _start() async {
    setState(() {
      _status = SpeedoStatus.requesting;
      _errorMessage = null;
    });

    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        setState(() {
          _status = SpeedoStatus.error;
          _errorMessage = 'Activa el GPS del dispositivo';
        });
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() {
          _status = SpeedoStatus.denied;
          _errorMessage = 'Permiso de ubicación denegado';
        });
        return;
      }

      _lastPosition = null;
      _lastFixTime = null;
      _filteredSpeed = 0;

      final stream = Geolocator.getPositionStream(
        locationSettings: AndroidSettings(
          accuracy: LocationAccuracy.bestForNavigation,
          distanceFilter: 0,
          intervalDuration: const Duration(milliseconds: 500),
          foregroundNotificationConfig: const ForegroundNotificationConfig(
            notificationTitle: 'Velocímetro activo',
            notificationText: 'Midiendo velocidad por GPS',
            notificationIcon: AndroidResource(
              name: 'ic_launcher',
              defType: 'mipmap',
            ),
            enableWakeLock: true,
          ),
        ),
      );

      _sub = stream.listen(
        _onPosition,
        onError: (Object e) {
          setState(() {
            _status = SpeedoStatus.error;
            _errorMessage = e.toString();
          });
        },
      );

      setState(() => _status = SpeedoStatus.measuring);
    } catch (e) {
      setState(() {
        _status = SpeedoStatus.error;
        _errorMessage = e.toString();
      });
    }
  }

  Future<void> _stop() async {
    await _sub?.cancel();
    _sub = null;
    setState(() {
      _status = SpeedoStatus.idle;
      _speedKmh = 0;
      _filteredSpeed = 0;
      _accuracy = 0;
    });
  }

  void _onPosition(Position p) {
    double instantKmh;

    if (p.speed >= 0) {
      instantKmh = p.speed * 3.6;
    } else {
      instantKmh = _computeSpeed(p);
    }

    // Filtro de media exponencial para suavizar el GPS
    _filteredSpeed = _filteredSpeed == 0
        ? instantKmh
        : _filteredSpeed * 0.6 + instantKmh * 0.4;

    if (!mounted) return;
    setState(() {
      _speedKmh = _filteredSpeed.clamp(0.0, maxKmh * 1.5);
      _accuracy = p.accuracy;
      if (_status == SpeedoStatus.requesting) {
        _status = SpeedoStatus.measuring;
      }
    });
  }

  double _computeSpeed(Position p) {
    if (_lastPosition == null || _lastFixTime == null) {
      _lastPosition = p;
      _lastFixTime = DateTime.now();
      return 0;
    }
    final dt = DateTime.now().difference(_lastFixTime!).inMilliseconds / 1000;
    if (dt <= 0.1) return 0;
    final dist = Geolocator.distanceBetween(
      _lastPosition!.latitude,
      _lastPosition!.longitude,
      p.latitude,
      p.longitude,
    );
    _lastPosition = p;
    _lastFixTime = DateTime.now();
    return (dist / dt) * 3.6;
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fraction = (_speedKmh / maxKmh).clamp(0.0, 1.0);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 24),
            Text(
              'VELOCÍMETRO GPS',
              style: Theme.of(context).textTheme.titleMedium
                  ?.copyWith(letterSpacing: 4, color: Colors.white60),
            ),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final gaugeW = math.min(
                    constraints.maxWidth * 0.9,
                    constraints.maxHeight / 1.15,
                  );
                  final gaugeH = gaugeW * 1.15;
                  return Center(
                    child: SizedBox(
                      width: gaugeW,
                      height: gaugeH,
                      child: CustomPaint(
                        painter: GaugePainter(
                          fraction: fraction,
                          color: _gaugeColor(fraction),
                        ),
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _speedKmh.toStringAsFixed(0),
                                style: TextStyle(
                                  fontSize: 84,
                                  fontWeight: FontWeight.w800,
                                  color: _gaugeColor(fraction),
                                  height: 1,
                                ),
                              ),
                              const Text(
                                'km/h',
                                style: TextStyle(
                                  fontSize: 22,
                                  letterSpacing: 3,
                                  color: Colors.white70,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _statusText(),
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: Colors.white54,
                                ),
                              ),
                              if (_measuring && _accuracy > 0)
                                Text(
                                  '±${_accuracy.toStringAsFixed(0)} m',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Colors.white38,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 32),
              child: _measuring || _status == SpeedoStatus.requesting
                  ? FilledButton.icon(
                      onPressed: _toggle,
                      icon: const Icon(Icons.stop_rounded),
                      label: const Text('DETENER'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.redAccent,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 48,
                          vertical: 16,
                        ),
                        textStyle: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                    )
                  : FilledButton.icon(
                      onPressed: _toggle,
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: const Text('INICIAR'),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF22D3EE),
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 48,
                          vertical: 16,
                        ),
                        textStyle: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Color _gaugeColor(double fraction) {
    if (fraction < 0.5) return const Color(0xFF22D3EE);
    if (fraction < 0.8) return const Color(0xFFFBBF24);
    return const Color(0xFFEF4444);
  }

  String _statusText() {
    switch (_status) {
      case SpeedoStatus.idle:
        return 'Toca INICIAR para medir';
      case SpeedoStatus.requesting:
        return 'Solicitando permiso de GPS…';
      case SpeedoStatus.measuring:
        return 'Midiendo velocidad…';
      case SpeedoStatus.denied:
        return _errorMessage ?? 'Permiso denegado';
      case SpeedoStatus.error:
        return _errorMessage ?? 'Error';
    }
  }
}

class GaugePainter extends CustomPainter {
  GaugePainter({required this.fraction, required this.color});

  final double fraction;
  final Color color;

  static const double _startAngle = 135 * math.pi / 180; // 225° total sweep
  static const double _sweep = 270 * math.pi / 180;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2 + size.height * 0.08);
    final radius = size.width * 0.42;
    final strokeWidth = size.width * 0.045;

    final bgPaint = Paint()
      ..color = const Color(0xFF1E2433)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    final fgPaint = Paint()
      ..shader = SweepGradient(
        startAngle: _startAngle,
        endAngle: _startAngle + _sweep,
        colors: [
          const Color(0xFF22D3EE),
          const Color(0xFFFBBF24),
          const Color(0xFFEF4444),
        ],
        stops: const [0.0, 0.65, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    // Arco de fondo
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      _startAngle,
      _sweep,
      false,
      bgPaint,
    );

    // Arco de progreso
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      _startAngle,
      _sweep * fraction,
      false,
      fgPaint,
    );

    // Aguja
    final needleAngle = _startAngle + _sweep * fraction;
    final needleLength = radius * 0.82;
    final needleEnd = Offset(
      center.dx + needleLength * math.cos(needleAngle),
      center.dy + needleLength * math.sin(needleAngle),
    );
    canvas.drawLine(
      center,
      needleEnd,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.9)
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round,
    );

    // Centro de la aguja
    canvas.drawCircle(center, 7, Paint()..color = color);
    canvas.drawCircle(center, 3, Paint()..color = Colors.white);

    // Marcas de escala
    final tickPaint = Paint()
      ..color = Colors.white24
      ..strokeWidth = 2;
    for (int i = 0; i <= 12; i++) {
      final a = _startAngle + _sweep * i / 12;
      final inner = radius - strokeWidth * 0.9;
      final outer = radius - strokeWidth * 0.9 - (i % 3 == 0 ? 14 : 8);
      canvas.drawLine(
        Offset(
          center.dx + inner * math.cos(a),
          center.dy + inner * math.sin(a),
        ),
        Offset(
          center.dx + outer * math.cos(a),
          center.dy + outer * math.sin(a),
        ),
        tickPaint,
      );
    }
  }

  @override
  bool shouldRepaint(GaugePainter oldDelegate) =>
      oldDelegate.fraction != fraction || oldDelegate.color != color;
}
