<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->string('category', 50)->default('residential')->after('description');
        });

        // Backfill existing services based on keywords
        $services = DB::table('services')->get();
        foreach ($services as $svc) {
            $name = strtolower($svc->name);
            $cat = 'residential';

            if (str_contains($name, 'commercial') || str_contains($name, 'office') || str_contains($name, 'building')) {
                $cat = 'commercial';
            } elseif (str_contains($name, 'pool') || str_contains($name, 'garden') || str_contains($name, 'landscape') || str_contains($name, 'maintenance')) {
                $cat = 'maintenance';
            } elseif (str_contains($name, 'deep') || str_contains($name, 'move') || str_contains($name, 'carpet') || str_contains($name, 'sofa') || str_contains($name, 'window') || str_contains($name, 'glass')) {
                $cat = 'specialized';
            }

            DB::table('services')->where('id', $svc->id)->update(['category' => $cat]);
        }
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
