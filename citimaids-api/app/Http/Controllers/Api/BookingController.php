<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingDetail;
use App\Models\Client;
use App\Models\Service;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    // Public: list all bookings (admin) or with filters
    public function index(Request $request)
    {
        $query = Booking::with(['client', 'service', 'processedBy']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('client', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return response()->json($query->latest()->paginate(15));
    }

    // Public: customer submits a booking inquiry
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'           => 'required|string|max:255',
            'contact_number' => 'nullable|string|max:50',
            'phone'          => 'nullable|string|max:50',
            'email'          => 'nullable|email|max:255',
            'address'        => 'required|string',
            'service_id'     => 'required|exists:services,id',
            'preferred_date' => 'nullable|date',
            'date'           => 'nullable|date',
            'preferred_time' => 'nullable|string|max:50',
            'time'           => 'nullable|string|max:50',
            'rates'          => 'nullable|numeric|min:0',
            'total_amount'   => 'nullable|numeric|min:0',
            'status'         => 'nullable|string|in:pending,confirmed,completed,cancelled',
            'notes'          => 'nullable|string',
        ]);

        $contactNumber = $validated['contact_number'] ?? $validated['phone'] ?? $request->input('phone');
        if (empty($contactNumber)) {
            return response()->json([
                'message' => 'The contact number or phone is required.',
                'errors'  => ['contact_number' => ['The phone number is required.']],
            ], 422);
        }

        $preferredDate = $validated['preferred_date'] ?? $validated['date'] ?? $request->input('date');
        if (empty($preferredDate)) {
            return response()->json([
                'message' => 'The booking date is required.',
                'errors'  => ['preferred_date' => ['The booking date is required.']],
            ], 422);
        }

        // Ensure the selected service is currently active and available for customer booking
        $service = Service::where('id', $validated['service_id'])
            ->where('status', 'active')
            ->first();

        if (! $service) {
            return response()->json([
                'message' => 'The selected service is currently unavailable for booking.',
                'errors'  => ['service_id' => ['The selected service is currently inactive.']],
            ], 422);
        }

        // Create or update client record by contact number or email
        $client = Client::where('contact_number', $contactNumber)
            ->when(!empty($validated['email']), function ($q) use ($validated) {
                $q->orWhere('email', $validated['email']);
            })
            ->first();

        if ($client) {
            $client->update([
                'name'           => $validated['name'],
                'contact_number' => $contactNumber,
                'email'          => $validated['email'] ?? $client->email,
                'address'        => $validated['address'] ?? $client->address,
            ]);
        } else {
            $client = Client::create([
                'name'           => $validated['name'],
                'contact_number' => $contactNumber,
                'email'          => $validated['email'] ?? null,
                'address'        => $validated['address'],
            ]);
        }

        $rateAmount = $validated['rates'] ?? $validated['total_amount'] ?? $service->base_price ?? 0;
        $bookingStatus = $validated['status'] ?? 'pending';
        $timeSlot = $validated['preferred_time'] ?? $validated['time'] ?? null;

        $booking = Booking::create([
            'client_id'      => $client->id,
            'service_id'     => $service->id,
            'preferred_date' => $preferredDate,
            'preferred_time' => $timeSlot,
            'address'        => $validated['address'],
            'notes'          => $validated['notes'] ?? null,
            'status'         => $bookingStatus,
            'total_amount'   => $rateAmount,
            'payment_status' => 'unpaid',
            'payment_method' => 'Cash on Completion',
        ]);

        // Record booking detail for line-item tracking
        BookingDetail::create([
            'booking_id'  => $booking->id,
            'service_id'  => $service->id,
            'quantity'    => 1,
            'unit_price'  => $service->base_price,
            'total_price' => $rateAmount,
        ]);

        return response()->json([
            'message'    => 'Booking request submitted successfully.',
            'booking_id' => $booking->id,
            'reference'  => 'CM-' . str_pad($booking->id, 5, '0', STR_PAD_LEFT),
            'booking'    => $booking->load(['client', 'service']),
        ], 201);
    }

    /**
     * Public Booking Tracking Endpoint
     *
     * Allows customers to check the real-time status of their booking without requiring authentication.
     * Searches by either:
     *   - 'ref' or 'reference' (e.g. "CM-00001", "CM1", or numeric ID 1)
     *   - 'phone' or 'contact_number' (matched against client records)
     *
     * Features:
     *   - Generates an active 4-step dispatch timeline (Inquiry -> Confirmed -> En Route -> Completed).
     *   - Masks client names (e.g., "Sarah A.") for privacy on public queries.
     *   - Returns sanitized service, scheduling, payment status, and location details.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function track(Request $request)
    {
        $query = Booking::with(['service', 'client', 'details.service']);

        $ref = $request->query('ref') ?? $request->query('reference');
        $phone = $request->query('phone') ?? $request->query('contact_number');

        if (!$ref && !$phone) {
            return response()->json([
                'message' => 'Please provide a booking reference number or contact number.'
            ], 422);
        }

        if ($ref) {
            $cleanRef = preg_replace('/[^0-9]/', '', $ref);
            if (empty($cleanRef)) {
                return response()->json(['message' => 'Invalid reference number format.'], 404);
            }
            $query->where('id', (int) $cleanRef);
        } elseif ($phone) {
            $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
            $query->whereHas('client', function ($q) use ($cleanPhone, $phone) {
                $q->where('contact_number', 'like', "%{$cleanPhone}%")
                  ->orWhere('contact_number', 'like', "%{$phone}%");
            });
        }

        $booking = $query->latest()->first();

        if (!$booking) {
            return response()->json([
                'message' => 'No booking found matching your details. Please verify your reference number or contact our dispatch team.'
            ], 404);
        }

        $steps = [
            [
                'key' => 'pending',
                'title' => 'Inquiry Received',
                'description' => 'Your booking request is logged and awaiting dispatch scheduling.',
            ],
            [
                'key' => 'confirmed',
                'title' => 'Confirmed & Scheduled',
                'description' => 'Slot confirmed. Cleaning team and supplies allocated for your slot.',
            ],
            [
                'key' => 'en_route',
                'title' => 'Crew En Route',
                'description' => 'Your cleaning specialists are on their way to your location.',
            ],
            [
                'key' => 'completed',
                'title' => 'Service Completed',
                'description' => 'Cleaning completed with inspection checklist verified.',
            ],
        ];

        $statusIndex = match ($booking->status) {
            'pending' => 0,
            'confirmed' => 1,
            'completed' => 3,
            'cancelled' => -1,
            default => 0,
        };

        $timeline = array_map(function ($step, $index) use ($statusIndex, $booking) {
            $isCancelled = $booking->status === 'cancelled';
            return [
                'key' => $step['key'],
                'title' => $step['title'],
                'description' => $step['description'],
                'done' => !$isCancelled && $index <= $statusIndex,
                'current' => !$isCancelled && $index === $statusIndex,
            ];
        }, $steps, array_keys($steps));

        $clientName = $booking->client?->name ?? 'Valued Client';
        $parts = explode(' ', trim($clientName));
        $maskedName = count($parts) > 1 
            ? $parts[0] . ' ' . strtoupper(substr(end($parts), 0, 1)) . '.' 
            : $parts[0];

        return response()->json([
            'booking_id'      => $booking->id,
            'reference'       => 'CM-' . str_pad($booking->id, 5, '0', STR_PAD_LEFT),
            'status'          => $booking->status,
            'is_cancelled'    => $booking->status === 'cancelled',
            'client_name'     => $maskedName,
            'contact_number'  => $booking->client?->contact_number,
            'preferred_date'  => $booking->preferred_date,
            'address'         => $booking->address,
            'notes'           => $booking->notes,
            'total_amount'    => $booking->total_amount,
            'payment_status'  => $booking->payment_status ?? 'unpaid',
            'payment_method'  => $booking->payment_method ?? 'Cash on Completion',
            'service'         => [
                'id'          => $booking->service?->id,
                'name'        => $booking->service?->name,
                'rate'        => $booking->service?->rate,
                'rate_type'   => $booking->service?->rate_type,
            ],
            'timeline'        => $timeline,
            'created_at'      => $booking->created_at?->format('M d, Y h:i A'),
            'updated_at'      => $booking->updated_at?->format('M d, Y h:i A'),
        ]);
    }

    public function show($id)
    {
        $booking = Booking::with(['client', 'service', 'processedBy', 'details.service'])->findOrFail($id);
        return response()->json($booking);
    }

    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:pending,confirmed,completed,cancelled',
        ]);

        $booking = Booking::findOrFail($id);
        $booking->update([
            'status'               => $request->status,
            'processed_by_user_id' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Status updated.', 'booking' => $booking->load(['client', 'service'])]);
    }

    public function destroy($id)
    {
        Booking::findOrFail($id)->delete();
        return response()->json(['message' => 'Booking deleted.']);
    }
}
